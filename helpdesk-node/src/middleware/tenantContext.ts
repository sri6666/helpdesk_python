import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

// Control plane Prisma client (public schema)
const controlPrisma = new PrismaClient();

// Cache for tenant Prisma clients (to avoid creating new clients on every request)
const tenantPrismaCache = new Map<string, PrismaClient>();

// Extend Express Request type to include tenant context
declare global {
  namespace Express {
    interface Request {
      tenant?: {
        id: string;
        subdomain: string;
        schemaName: string;
        companyName: string;
        plan: string;
        status: string;
      };
      tenantPrisma?: PrismaClient;
      controlPrisma?: PrismaClient;
    }
  }
}

/**
 * Extract subdomain from hostname
 * Examples:
 * - acme.helpdeskapp.com -> acme
 * - localhost:3000 -> null (for local development)
 * - acme.localhost:3000 -> acme (for local testing)
 */
function extractSubdomain(hostname: string): string | null {
  // Remove port if present
  const host = hostname.split(':')[0];

  // For localhost development, check for subdomain pattern
  if (host.includes('localhost')) {
    const parts = host.split('.');
    if (parts.length > 1 && parts[0] !== 'www') {
      return parts[0]; // e.g., acme.localhost -> acme
    }
    return null; // Just localhost -> no tenant
  }

  // For production domains (e.g., acme.helpdeskapp.com)
  const parts = host.split('.');

  // Need at least 3 parts for subdomain (subdomain.domain.tld)
  if (parts.length < 3) {
    return null;
  }

  const subdomain = parts[0];

  // Skip common prefixes
  if (subdomain === 'www' || subdomain === 'api' || subdomain === 'app') {
    return null;
  }

  return subdomain;
}

/**
 * Get or create Prisma client for tenant schema
 */
function getTenantPrismaClient(schemaName: string): PrismaClient {
  // Check cache first
  if (tenantPrismaCache.has(schemaName)) {
    return tenantPrismaCache.get(schemaName)!;
  }

  // Create new client for this tenant schema
  const client = new PrismaClient({
    datasources: {
      db: {
        url: `${process.env.DATABASE_URL}?schema=${schemaName}`,
      },
    },
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

  // Cache it
  tenantPrismaCache.set(schemaName, client);

  // Limit cache size to prevent memory issues
  if (tenantPrismaCache.size > 100) {
    // Remove oldest entry
    const firstKey = tenantPrismaCache.keys().next().value;
    const oldClient = tenantPrismaCache.get(firstKey);
    oldClient?.$disconnect();
    tenantPrismaCache.delete(firstKey);
  }

  return client;
}

/**
 * Tenant Context Middleware
 * Extracts tenant from subdomain and attaches to request
 */
export async function tenantContextMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Skip for health checks and public routes
    if (
      req.path === '/api/health' ||
      req.path === '/health' ||
      req.path.startsWith('/api/auth/') ||
      req.path.startsWith('/api/control/')
    ) {
      req.controlPrisma = controlPrisma;
      return next();
    }

    // Extract subdomain
    const subdomain = extractSubdomain(req.hostname);

    // If no subdomain, this is not a tenant request
    if (!subdomain) {
      logger.warn(`No subdomain found in hostname: ${req.hostname}`);
      res.status(400).json({
        error: 'Invalid request',
        message: 'No tenant subdomain provided',
      });
      return;
    }

    // Fetch tenant from control plane database
    const tenant = await controlPrisma.tenant.findUnique({
      where: { subdomain },
      include: {
        credits: true,
      },
    });

    if (!tenant) {
      logger.warn(`Tenant not found for subdomain: ${subdomain}`);
      res.status(404).json({
        error: 'Tenant not found',
        message: `No tenant exists for subdomain: ${subdomain}`,
      });
      return;
    }

    // Check tenant status
    if (tenant.status !== 'active') {
      logger.warn(`Tenant ${subdomain} is ${tenant.status}`);
      res.status(403).json({
        error: 'Tenant unavailable',
        message: `This helpdesk instance is currently ${tenant.status}`,
        status: tenant.status,
      });
      return;
    }

    // Attach tenant context to request
    req.tenant = {
      id: tenant.id,
      subdomain: tenant.subdomain,
      schemaName: tenant.schemaName,
      companyName: tenant.companyName,
      plan: tenant.plan,
      status: tenant.status,
    };

    // Attach Prisma clients
    req.controlPrisma = controlPrisma; // For accessing control plane data
    req.tenantPrisma = getTenantPrismaClient(tenant.schemaName); // For tenant-specific data

    logger.info(`Request authenticated for tenant: ${subdomain} (schema: ${tenant.schemaName})`);

    next();
  } catch (error) {
    logger.error('Error in tenant context middleware:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to resolve tenant context',
    });
  }
}

/**
 * Require tenant middleware
 * Use this for routes that must have a tenant context
 */
export function requireTenant(req: Request, res: Response, next: NextFunction): void {
  if (!req.tenant || !req.tenantPrisma) {
    res.status(400).json({
      error: 'Tenant required',
      message: 'This endpoint requires a valid tenant context',
    });
    return;
  }

  next();
}

/**
 * Clean up Prisma client cache on shutdown
 */
export async function cleanupTenantClients(): Promise<void> {
  logger.info('Cleaning up tenant Prisma clients...');

  for (const [schema, client] of tenantPrismaCache.entries()) {
    await client.$disconnect();
    logger.info(`Disconnected Prisma client for schema: ${schema}`);
  }

  tenantPrismaCache.clear();
  await controlPrisma.$disconnect();

  logger.info('All Prisma clients disconnected');
}

// Handle process shutdown
process.on('SIGTERM', cleanupTenantClients);
process.on('SIGINT', cleanupTenantClients);
