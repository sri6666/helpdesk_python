import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

const router = express.Router();
const controlPrisma = new PrismaClient();

/**
 * POST /api/control/signup
 * Create a new SaaS account (control user)
 */
router.post('/signup', async (req: Request, res: Response) => {
  try {
    const { email, password, fullName } = req.body;

    // Validation
    if (!email || !password || !fullName) {
      res.status(400).json({
        error: 'Missing required fields',
        required: ['email', 'password', 'fullName'],
      });
      return;
    }

    // Check if user already exists
    const existingUser = await controlPrisma.controlUser.findUnique({
      where: { email },
    });

    if (existingUser) {
      res.status(400).json({
        error: 'User already exists',
        message: 'An account with this email already exists',
      });
      return;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create control user
    const user = await controlPrisma.controlUser.create({
      data: {
        email,
        passwordHash,
        fullName,
        role: 'owner',
      },
    });

    logger.info(`Created control user: ${email}`);

    res.status(201).json({
      message: 'Account created successfully',
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
      },
    });
  } catch (error) {
    logger.error('Error in signup:', error);
    res.status(500).json({
      error: 'Failed to create account',
    });
  }
});

/**
 * POST /api/control/login
 * Login to control plane (SaaS portal)
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        error: 'Missing required fields',
        required: ['email', 'password'],
      });
      return;
    }

    // Find user
    const user = await controlPrisma.controlUser.findUnique({
      where: { email },
    });

    if (!user) {
      res.status(401).json({
        error: 'Invalid credentials',
      });
      return;
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.passwordHash);

    if (!isValid) {
      res.status(401).json({
        error: 'Invalid credentials',
      });
      return;
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
    });
  } catch (error) {
    logger.error('Error in login:', error);
    res.status(500).json({
      error: 'Failed to login',
    });
  }
});

/**
 * POST /api/control/tenants/provision
 * Provision a new tenant (helpdesk instance)
 */
router.post('/tenants/provision', async (req: Request, res: Response) => {
  try {
    // TODO: Add authentication middleware for control plane
    const { userId, companyName, subdomain, plan = 'free' } = req.body;

    // Validation
    if (!userId || !companyName || !subdomain) {
      res.status(400).json({
        error: 'Missing required fields',
        required: ['userId', 'companyName', 'subdomain'],
      });
      return;
    }

    // Validate subdomain format (alphanumeric, lowercase, hyphens only)
    const subdomainRegex = /^[a-z0-9-]+$/;
    if (!subdomainRegex.test(subdomain)) {
      res.status(400).json({
        error: 'Invalid subdomain',
        message: 'Subdomain must contain only lowercase letters, numbers, and hyphens',
      });
      return;
    }

    // Check if subdomain is available
    const existingTenant = await controlPrisma.tenant.findUnique({
      where: { subdomain },
    });

    if (existingTenant) {
      res.status(400).json({
        error: 'Subdomain already taken',
        message: `The subdomain "${subdomain}" is already in use`,
      });
      return;
    }

    // Verify user exists
    const user = await controlPrisma.controlUser.findUnique({
      where: { id: userId },
    });

    if (!user) {
      res.status(404).json({
        error: 'User not found',
      });
      return;
    }

    // Get plan details
    const planDetails = await controlPrisma.plan.findUnique({
      where: { name: plan },
    });

    if (!planDetails) {
      res.status(400).json({
        error: 'Invalid plan',
        message: `Plan "${plan}" does not exist`,
      });
      return;
    }

    // Generate unique schema name
    const schemaName = `tenant_${uuidv4().replace(/-/g, '')}`;

    // Create tenant record
    const tenant = await controlPrisma.tenant.create({
      data: {
        userId,
        companyName,
        subdomain,
        schemaName,
        plan,
        status: 'provisioning',
      },
    });

    logger.info(`Created tenant: ${subdomain} (${tenant.id})`);

    // Initialize credits
    await controlPrisma.credits.create({
      data: {
        tenantId: tenant.id,
        balance: planDetails.creditsMonthly,
        plan,
        monthlyAllocation: planDetails.creditsMonthly,
        resetAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      },
    });

    // Provision database schema in the background
    provisionTenantDatabase(tenant.id, schemaName).catch((error) => {
      logger.error(`Failed to provision database for tenant ${tenant.id}:`, error);
    });

    res.status(201).json({
      message: 'Tenant provisioning started',
      tenant: {
        id: tenant.id,
        subdomain: tenant.subdomain,
        companyName: tenant.companyName,
        plan: tenant.plan,
        status: tenant.status,
        url: `https://${tenant.subdomain}.${process.env.DOMAIN || 'helpdeskapp.com'}`,
      },
      estimatedTime: '30 seconds',
    });
  } catch (error) {
    logger.error('Error in tenant provisioning:', error);
    res.status(500).json({
      error: 'Failed to provision tenant',
    });
  }
});

/**
 * GET /api/control/tenants
 * Get all tenants for a user
 */
router.get('/tenants', async (req: Request, res: Response) => {
  try {
    // TODO: Get userId from authenticated session
    const { userId } = req.query;

    if (!userId) {
      res.status(400).json({
        error: 'Missing userId parameter',
      });
      return;
    }

    const tenants = await controlPrisma.tenant.findMany({
      where: { userId: userId as string },
      include: {
        credits: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      tenants: tenants.map((t) => ({
        id: t.id,
        subdomain: t.subdomain,
        companyName: t.companyName,
        plan: t.plan,
        status: t.status,
        url: `https://${t.subdomain}.${process.env.DOMAIN || 'helpdeskapp.com'}`,
        credits: {
          balance: t.credits?.balance || 0,
          plan: t.credits?.plan,
        },
        createdAt: t.createdAt,
      })),
    });
  } catch (error) {
    logger.error('Error fetching tenants:', error);
    res.status(500).json({
      error: 'Failed to fetch tenants',
    });
  }
});

/**
 * GET /api/control/tenants/:id/status
 * Get provisioning status of a tenant
 */
router.get('/tenants/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const tenant = await controlPrisma.tenant.findUnique({
      where: { id },
      include: { credits: true },
    });

    if (!tenant) {
      res.status(404).json({
        error: 'Tenant not found',
      });
      return;
    }

    res.json({
      id: tenant.id,
      subdomain: tenant.subdomain,
      status: tenant.status,
      plan: tenant.plan,
      credits: tenant.credits?.balance || 0,
      url:
        tenant.status === 'active'
          ? `https://${tenant.subdomain}.${process.env.DOMAIN || 'helpdeskapp.com'}`
          : null,
    });
  } catch (error) {
    logger.error('Error fetching tenant status:', error);
    res.status(500).json({
      error: 'Failed to fetch tenant status',
    });
  }
});

/**
 * GET /api/control/plans
 * Get all available SaaS plans
 */
router.get('/plans', async (req: Request, res: Response) => {
  try {
    const plans = await controlPrisma.plan.findMany({
      where: { isActive: true },
      orderBy: { priceMonthly: 'asc' },
    });

    res.json({
      plans: plans.map((p) => ({
        name: p.name,
        displayName: p.displayName,
        description: p.description,
        pricing: {
          monthly: p.priceMonthly / 100, // Convert cents to dollars
          annual: p.priceAnnual ? p.priceAnnual / 100 : null,
        },
        credits: {
          monthly: p.creditsMonthly,
          annual: p.creditsAnnual,
        },
        limits: {
          maxAgents: p.maxAgents,
          maxTickets: p.maxTickets,
          maxStorage: p.maxStorage,
        },
        features: p.features,
      })),
    });
  } catch (error) {
    logger.error('Error fetching plans:', error);
    res.status(500).json({
      error: 'Failed to fetch plans',
    });
  }
});

/**
 * Background function to provision tenant database
 */
async function provisionTenantDatabase(tenantId: string, schemaName: string): Promise<void> {
  try {
    logger.info(`Starting database provisioning for schema: ${schemaName}`);

    // 1. Create schema
    await controlPrisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`);
    logger.info(`Created schema: ${schemaName}`);

    // 2. Run migrations (simplified - in production, use proper migration tooling)
    // For now, we'll just mark as active and let manual migration handle it
    // TODO: Implement automated migration execution per tenant schema

    // 3. Update tenant status
    await controlPrisma.tenant.update({
      where: { id: tenantId },
      data: { status: 'active' },
    });

    logger.info(`Tenant ${tenantId} provisioned successfully`);
  } catch (error) {
    logger.error(`Failed to provision tenant ${tenantId}:`, error);

    // Mark tenant as failed
    await controlPrisma.tenant.update({
      where: { id: tenantId },
      data: { status: 'failed' },
    });

    throw error;
  }
}

export default router;
