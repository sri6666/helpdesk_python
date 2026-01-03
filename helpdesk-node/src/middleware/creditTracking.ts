import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * Credit costs for various actions
 */
const CREDIT_COSTS: Record<string, number> = {
  // Tickets
  'create_ticket': 1.0,
  'update_ticket': 0.2,
  'delete_ticket': 0.1,

  // Comments
  'add_comment': 0.5,
  'update_comment': 0.1,
  'delete_comment': 0.1,

  // Attachments
  'upload_file': 2.0, // Per MB
  'delete_file': 0.1,

  // Notifications
  'send_email': 0.1,
  'send_sms': 0.5,

  // API Calls
  'api_call': 0.1,

  // Knowledge Base
  'create_article': 0.5,
  'update_article': 0.2,

  // Other
  'create_user': 0.5,
  'bulk_operation': 5.0,
};

/**
 * Map route patterns to actions
 */
function getActionFromRoute(method: string, path: string): string | null {
  // Tickets
  if (method === 'POST' && path.includes('/tickets')) return 'create_ticket';
  if (method === 'PUT' && path.includes('/tickets')) return 'update_ticket';
  if (method === 'PATCH' && path.includes('/tickets')) return 'update_ticket';
  if (method === 'DELETE' && path.includes('/tickets')) return 'delete_ticket';

  // Comments
  if (method === 'POST' && path.includes('/comments')) return 'add_comment';
  if (method === 'PUT' && path.includes('/comments')) return 'update_comment';
  if (method === 'PATCH' && path.includes('/comments')) return 'update_comment';
  if (method === 'DELETE' && path.includes('/comments')) return 'delete_comment';

  // Attachments
  if (method === 'POST' && path.includes('/attachments')) return 'upload_file';
  if (method === 'DELETE' && path.includes('/attachments')) return 'delete_file';

  // Articles
  if (method === 'POST' && path.includes('/articles')) return 'create_article';
  if (method === 'PUT' && path.includes('/articles')) return 'update_article';
  if (method === 'PATCH' && path.includes('/articles')) return 'update_article';

  // Users
  if (method === 'POST' && path.includes('/users')) return 'create_user';

  // Generic API call for GET requests
  if (method === 'GET') return 'api_call';

  return null;
}

/**
 * Get credit cost for an action
 */
function getCreditCost(action: string, metadata?: any): number {
  const baseCost = CREDIT_COSTS[action] || 0;

  // For file uploads, multiply by file size in MB
  if (action === 'upload_file' && metadata?.fileSize) {
    const fileSizeMB = metadata.fileSize / (1024 * 1024);
    return baseCost * Math.ceil(fileSizeMB);
  }

  return baseCost;
}

/**
 * Track credit usage for an action
 */
async function trackCreditUsage(
  tenantId: string,
  action: string,
  credits: number,
  metadata: any,
  controlPrisma: any
): Promise<void> {
  try {
    // Log usage
    await controlPrisma.usageLog.create({
      data: {
        tenantId,
        action,
        credits,
        metadata,
        timestamp: new Date(),
      },
    });

    // Deduct credits
    await controlPrisma.credits.update({
      where: { tenantId },
      data: {
        balance: {
          decrement: credits,
        },
      },
    });

    logger.info(`Tracked ${credits} credits for action: ${action} (tenant: ${tenantId})`);
  } catch (error) {
    logger.error('Failed to track credit usage:', error);
    // Don't throw - we don't want to fail the request if credit tracking fails
  }
}

/**
 * Credit Tracking Middleware
 * Automatically tracks and deducts credits for tenant actions
 */
export async function creditTrackingMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Skip if no tenant context
  if (!req.tenant || !req.controlPrisma) {
    return next();
  }

  // Skip for read-only GET requests to reduce credit consumption
  // (unless you want to charge for all API calls)
  const action = getActionFromRoute(req.method, req.path);

  if (!action) {
    return next();
  }

  try {
    // Check if tenant has credits
    const credits = await req.controlPrisma.credits.findUnique({
      where: { tenantId: req.tenant.id },
    });

    if (!credits) {
      logger.error(`No credits record found for tenant: ${req.tenant.id}`);
      res.status(500).json({
        error: 'Configuration error',
        message: 'Credit account not found',
      });
      return;
    }

    // Get credit cost for this action
    const metadata = {
      path: req.path,
      method: req.method,
      fileSize: req.body?.fileSize,
    };

    const creditCost = getCreditCost(action, metadata);

    // Check if tenant has enough credits
    if (credits.balance < creditCost) {
      logger.warn(`Insufficient credits for tenant: ${req.tenant.subdomain}`);
      res.status(402).json({
        error: 'Insufficient credits',
        message: 'You do not have enough credits to perform this action',
        required: creditCost,
        balance: credits.balance,
        plan: credits.plan,
      });
      return;
    }

    // Store action info for post-request tracking
    res.locals.creditTracking = {
      action,
      creditCost,
      metadata,
    };

    next();
  } catch (error) {
    logger.error('Error in credit tracking middleware:', error);
    // Don't fail the request, just log the error
    next();
  }
}

/**
 * Post-request credit tracking
 * Track credits after successful request completion
 */
export async function creditTrackingPostMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Only track if request was successful
  if (res.statusCode < 200 || res.statusCode >= 300) {
    return next();
  }

  // Skip if no tracking info
  if (!res.locals.creditTracking || !req.tenant || !req.controlPrisma) {
    return next();
  }

  const { action, creditCost, metadata } = res.locals.creditTracking;

  // Track usage asynchronously (don't block response)
  trackCreditUsage(req.tenant.id, action, creditCost, metadata, req.controlPrisma).catch((error) => {
    logger.error('Failed to track credits post-request:', error);
  });

  next();
}

/**
 * Check if tenant plan has unlimited credits
 */
export function hasUnlimitedCredits(plan: string): boolean {
  return plan === 'enterprise';
}

/**
 * Middleware to skip credit tracking for unlimited plans
 */
export function skipCreditTrackingForUnlimited(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (req.tenant && hasUnlimitedCredits(req.tenant.plan)) {
    // Skip credit tracking for enterprise plan
    return next();
  }

  // Continue with credit tracking
  creditTrackingMiddleware(req, res, next);
}

/**
 * Get credit balance for tenant
 */
export async function getCreditBalance(tenantId: string, controlPrisma: any): Promise<number> {
  const credits = await controlPrisma.credits.findUnique({
    where: { tenantId },
  });

  return credits?.balance || 0;
}

/**
 * Add credits to tenant account
 */
export async function addCredits(
  tenantId: string,
  amount: number,
  controlPrisma: any,
  metadata?: any
): Promise<void> {
  await controlPrisma.credits.update({
    where: { tenantId },
    data: {
      balance: {
        increment: amount,
      },
    },
  });

  // Log transaction
  await controlPrisma.transaction.create({
    data: {
      tenantId,
      type: 'purchase',
      amount: 0, // Set actual amount if applicable
      credits: amount,
      status: 'completed',
      metadata,
    },
  });

  logger.info(`Added ${amount} credits to tenant: ${tenantId}`);
}
