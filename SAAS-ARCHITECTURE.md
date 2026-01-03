# Multi-Tenant SaaS Architecture on AWS

## Overview

This document outlines the architecture for converting the Helpdesk application into a multi-tenant SaaS platform on AWS with credit-based provisioning.

## Architecture Model: Hybrid Approach

We'll use a **hybrid multi-tenant architecture**:
- **Shared Infrastructure**: Single ECS cluster, shared application code
- **Database Isolation**: Schema-per-tenant in shared RDS PostgreSQL
- **Tenant Isolation**: Middleware-based tenant context, separate schemas
- **Cost Efficiency**: Shared resources for 1-100 tenants/instance

### Why Hybrid?
- **Security**: Each tenant gets isolated database schema
- **Cost**: Shared application infrastructure reduces costs
- **Scalability**: Easy to move high-volume tenants to dedicated instances
- **Compliance**: Data isolation meets most regulatory requirements

## AWS Infrastructure

### 1. Application Layer
```
┌─────────────────────────────────────────────────────────────┐
│                     Application Load Balancer               │
│                    (SSL/TLS Termination)                     │
│              Route by subdomain: {tenant}.app.com            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Amazon ECS (Fargate)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Helpdesk API │  │ Helpdesk API │  │ Helpdesk API │      │
│  │  Container   │  │  Container   │  │  Container   │      │
│  │  (Task 1)    │  │  (Task 2)    │  │  (Task 3)    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         Auto-scaling based on CPU/Memory                     │
└─────────────────────────────────────────────────────────────┘
```

**Components**:
- **ALB**: Application Load Balancer for routing and SSL termination
- **ECS Fargate**: Serverless container orchestration
- **Auto Scaling**: 2-10 tasks based on load
- **Target Group**: Health checks every 30s

**Cost**: ~$50-200/month for 100 tenants

### 2. Database Layer

```
┌─────────────────────────────────────────────────────────────┐
│            Amazon RDS PostgreSQL (Multi-AZ)                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Database: helpdesk_saas                             │   │
│  │  ┌────────────────┐  ┌────────────────┐             │   │
│  │  │ Schema: tenant1│  │ Schema: tenant2│  ...        │   │
│  │  │ - tickets      │  │ - tickets      │             │   │
│  │  │ - users        │  │ - users        │             │   │
│  │  │ - comments     │  │ - comments     │             │   │
│  │  └────────────────┘  └────────────────┘             │   │
│  │                                                       │   │
│  │  Master Schema: public                               │   │
│  │  - tenants (id, subdomain, status, plan)            │   │
│  │  - users (global, maps to tenant)                   │   │
│  │  - credits (tenant_id, balance)                     │   │
│  │  - usage_tracking (tenant_id, resource, count)      │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**Schema Strategy**:
- **Public Schema**: Tenant metadata, user accounts, credits, billing
- **Tenant Schemas**: Isolated data per tenant (tenant_1, tenant_2, etc.)
- **Migration**: Prisma schema with multi-schema support
- **Backup**: Automated daily snapshots, 7-day retention

**Scaling**:
- Start: db.t3.medium (2 vCPU, 4GB RAM) - ~$60/month
- Scale: db.t3.large for 100+ tenants - ~$120/month

### 3. Caching Layer

```
┌─────────────────────────────────────────────────────────────┐
│         Amazon ElastiCache (Redis) - Multi-AZ                │
│  - Session storage (JWT tokens)                              │
│  - Rate limiting per tenant                                  │
│  - Job queues (Bull)                                         │
│  - Cache frequently accessed data                            │
│  Key Pattern: tenant:{tenant_id}:*                           │
└─────────────────────────────────────────────────────────────┘
```

**Cost**: cache.t3.micro - ~$15/month

### 4. Storage (S3)

```
┌─────────────────────────────────────────────────────────────┐
│                      Amazon S3                               │
│  Bucket: helpdesk-attachments-{env}                          │
│  ├── tenant-1/                                               │
│  │   ├── tickets/                                            │
│  │   └── avatars/                                            │
│  ├── tenant-2/                                               │
│  │   ├── tickets/                                            │
│  │   └── avatars/                                            │
│  └── ...                                                     │
│                                                               │
│  - Lifecycle: Move to Glacier after 90 days                  │
│  - Encryption: AES-256 (SSE-S3)                              │
│  - Access: IAM roles, signed URLs                            │
└─────────────────────────────────────────────────────────────┘
```

**Cost**: ~$1-5/month for 100 tenants (depends on usage)

## Landing Page & Control Plane

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  CloudFront + S3 (Landing)                   │
│              Static Site: www.helpdeskapp.com                │
│  - Homepage                                                  │
│  - Pricing                                                   │
│  - Signup Flow                                               │
│  - Login (Portal)                                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Control Plane API (ECS Fargate)                 │
│              api.helpdeskapp.com                             │
│  - User signup & authentication                              │
│  - Credit management                                         │
│  - Tenant provisioning                                       │
│  - Billing (Stripe integration)                              │
│  - Usage tracking & metering                                 │
└─────────────────────────────────────────────────────────────┘
```

### Landing Page Components

**Tech Stack**: Next.js (static export) or React SPA
- **Homepage**: Value proposition, features, pricing
- **Signup Flow**: Email → Plan Selection → Payment → Provisioning
- **Portal**: User dashboard, billing, usage stats, tenant management
- **Pricing Page**: Free tier, Starter, Professional, Enterprise

**Pages**:
1. `/` - Homepage
2. `/pricing` - Pricing plans
3. `/signup` - Registration form
4. `/login` - Portal login
5. `/portal` - User dashboard
6. `/portal/billing` - Credits & payments
7. `/portal/instances` - Manage helpdesk instances

## Tenant Provisioning Workflow

### User Journey

```
1. User visits www.helpdeskapp.com
   ↓
2. Clicks "Start Free Trial"
   ↓
3. Signs up (email, password, company name)
   ↓
4. Selects plan (Free/Starter/Pro)
   ↓
5. Purchases credits (if paid plan) via Stripe
   ↓
6. System provisions tenant:
   a. Creates subdomain: {company}.helpdeskapp.com
   b. Creates database schema: tenant_{id}
   c. Runs migrations in tenant schema
   d. Seeds initial data (admin user)
   e. Updates tenant status: "active"
   ↓
7. User receives email with login link
   ↓
8. User accesses {company}.helpdeskapp.com
   ↓
9. Logs in and starts using helpdesk
```

### Provisioning API Endpoint

```typescript
POST /api/control/tenants/provision
{
  "userId": "uuid",
  "companyName": "Acme Corp",
  "subdomain": "acme",
  "plan": "starter"
}

Response:
{
  "tenantId": "uuid",
  "subdomain": "acme",
  "url": "https://acme.helpdeskapp.com",
  "status": "provisioning",
  "estimatedTime": "30 seconds"
}
```

### Provisioning Steps (Backend)

```typescript
async function provisionTenant(data) {
  // 1. Validate subdomain availability
  const exists = await prisma.tenant.findUnique({
    where: { subdomain: data.subdomain }
  });
  if (exists) throw new Error('Subdomain taken');

  // 2. Create tenant record
  const tenant = await prisma.tenant.create({
    data: {
      userId: data.userId,
      companyName: data.companyName,
      subdomain: data.subdomain,
      plan: data.plan,
      status: 'provisioning',
      schemaName: `tenant_${uuid()}`
    }
  });

  // 3. Create database schema
  await prisma.$executeRaw`CREATE SCHEMA ${tenant.schemaName}`;

  // 4. Run migrations in tenant schema
  await runTenantMigrations(tenant.schemaName);

  // 5. Seed initial data
  await seedTenantData(tenant.schemaName, {
    adminEmail: user.email,
    adminPassword: generateTempPassword(),
    companyName: data.companyName
  });

  // 6. Initialize credits
  await prisma.credits.create({
    data: {
      tenantId: tenant.id,
      balance: getPlanCredits(data.plan),
      plan: data.plan
    }
  });

  // 7. Update tenant status
  await prisma.tenant.update({
    where: { id: tenant.id },
    data: { status: 'active' }
  });

  // 8. Send welcome email
  await sendWelcomeEmail(user.email, {
    url: `https://${tenant.subdomain}.helpdeskapp.com`,
    tempPassword: tempPassword
  });

  return tenant;
}
```

## Credit System Design

### Credit Model

**1 Credit = 1 Action**

| Action | Credits |
|--------|---------|
| Create Ticket | 1 credit |
| Add Comment | 0.5 credits |
| Upload File | 2 credits |
| Send Email Notification | 0.1 credits |
| API Call | 0.1 credits |

### Plans

```
┌─────────────────────────────────────────────────────────────┐
│  FREE TIER                                                   │
│  - 100 credits/month                                         │
│  - 1 agent                                                   │
│  - Email support                                             │
│  - $0/month                                                  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  STARTER                                                     │
│  - 1,000 credits/month                                       │
│  - 5 agents                                                  │
│  - Email + Chat support                                      │
│  - $29/month                                                 │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  PROFESSIONAL                                                │
│  - 10,000 credits/month                                      │
│  - Unlimited agents                                          │
│  - Priority support                                          │
│  - Custom branding                                           │
│  - $99/month                                                 │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  ENTERPRISE                                                  │
│  - Unlimited credits                                         │
│  - Dedicated instance                                        │
│  - SLA guarantee                                             │
│  - Custom features                                           │
│  - Contact sales                                             │
└─────────────────────────────────────────────────────────────┘
```

### Credit Tracking

```typescript
// Middleware: Track usage
async function trackUsage(req, res, next) {
  const tenant = req.tenant; // From tenant context middleware
  const action = req.route.path; // e.g., /api/tickets
  const creditCost = getCreditCost(action, req.method);

  // Check balance
  const credits = await prisma.credits.findUnique({
    where: { tenantId: tenant.id }
  });

  if (credits.balance < creditCost) {
    return res.status(402).json({
      error: 'Insufficient credits',
      balance: credits.balance,
      required: creditCost
    });
  }

  // Deduct credits
  await prisma.credits.update({
    where: { tenantId: tenant.id },
    data: { balance: { decrement: creditCost } }
  });

  // Log usage
  await prisma.usageLog.create({
    data: {
      tenantId: tenant.id,
      action: action,
      credits: creditCost,
      timestamp: new Date()
    }
  });

  next();
}
```

### Stripe Integration

```typescript
// Purchase credits
POST /api/control/credits/purchase
{
  "tenantId": "uuid",
  "amount": 5000, // $50 = 5000 credits
  "paymentMethodId": "pm_xxx"
}

// Stripe webhook handler
async function handleStripeWebhook(event) {
  if (event.type === 'payment_intent.succeeded') {
    const payment = event.data.object;
    const tenantId = payment.metadata.tenantId;
    const credits = payment.amount / 100; // $1 = 100 credits

    await prisma.credits.update({
      where: { tenantId },
      data: { balance: { increment: credits } }
    });

    await prisma.transactions.create({
      data: {
        tenantId,
        amount: payment.amount,
        credits,
        type: 'purchase',
        stripePaymentId: payment.id
      }
    });
  }
}
```

## Database Schema (Multi-Tenant)

### Public Schema (Tenant Management)

```prisma
// schema.prisma

model Tenant {
  id           String   @id @default(uuid())
  userId       String   // User who created this tenant
  companyName  String
  subdomain    String   @unique
  schemaName   String   @unique // e.g., tenant_abc123
  plan         String   // free, starter, professional, enterprise
  status       String   // provisioning, active, suspended, deleted
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  credits      Credits?
  usage        UsageLog[]

  @@index([subdomain])
  @@index([userId])
}

model Credits {
  id        String   @id @default(uuid())
  tenantId  String   @unique
  tenant    Tenant   @relation(fields: [tenantId], references: [id])
  balance   Int      @default(0)
  plan      String
  resetAt   DateTime // Monthly reset date
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model UsageLog {
  id        String   @id @default(uuid())
  tenantId  String
  tenant    Tenant   @relation(fields: [tenantId], references: [id])
  action    String   // create_ticket, add_comment, etc.
  credits   Float    // Credits consumed
  timestamp DateTime @default(now())
  metadata  Json?    // Additional data

  @@index([tenantId, timestamp])
}

model Transaction {
  id              String   @id @default(uuid())
  tenantId        String
  amount          Int      // Amount in cents
  credits         Int      // Credits purchased
  type            String   // purchase, refund
  stripePaymentId String?
  createdAt       DateTime @default(now())

  @@index([tenantId])
}

model User {
  id            String   @id @default(uuid())
  email         String   @unique
  passwordHash  String
  name          String?
  role          String   @default("owner") // owner, billing
  emailVerified Boolean  @default(false)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([email])
}
```

### Tenant Schema (per tenant)

Same as existing Prisma schema but deployed in tenant-specific schema:
- User (tenant users, not to confuse with control plane User)
- Ticket
- Comment
- Attachment
- etc.

## Tenant Context Middleware

```typescript
// middleware/tenantContext.ts

export async function tenantContextMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Extract subdomain from request
  const host = req.hostname; // e.g., acme.helpdeskapp.com
  const subdomain = host.split('.')[0];

  if (!subdomain || subdomain === 'www' || subdomain === 'api') {
    return res.status(400).json({ error: 'Invalid tenant' });
  }

  // Fetch tenant from database
  const tenant = await prisma.tenant.findUnique({
    where: { subdomain },
    include: { credits: true }
  });

  if (!tenant) {
    return res.status(404).json({ error: 'Tenant not found' });
  }

  if (tenant.status !== 'active') {
    return res.status(403).json({
      error: 'Tenant suspended',
      reason: tenant.status
    });
  }

  // Attach tenant to request
  req.tenant = tenant;

  // Set Prisma schema for this request
  req.prisma = getPrismaClientForSchema(tenant.schemaName);

  next();
}

// Helper to get Prisma client for specific schema
function getPrismaClientForSchema(schemaName: string) {
  return new PrismaClient({
    datasources: {
      db: {
        url: `${process.env.DATABASE_URL}?schema=${schemaName}`
      }
    }
  });
}
```

## Deployment Steps

### Phase 1: Infrastructure Setup

1. **VPC & Networking**
   - Create VPC with public/private subnets
   - Set up Internet Gateway and NAT Gateway
   - Configure security groups

2. **RDS Setup**
   - Launch PostgreSQL instance (Multi-AZ)
   - Configure security groups (allow ECS only)
   - Create initial database

3. **ElastiCache Setup**
   - Launch Redis cluster
   - Configure security groups

4. **S3 Buckets**
   - Create attachments bucket
   - Configure CORS and lifecycle policies

5. **ECR Repository**
   - Create repository for Docker images
   - Set up image scanning

### Phase 2: Application Deployment

1. **Build Docker Image**
   ```bash
   cd helpdesk-node
   docker build -t helpdesk-api:latest .
   docker tag helpdesk-api:latest <ECR_URL>/helpdesk-api:latest
   docker push <ECR_URL>/helpdesk-api:latest
   ```

2. **ECS Cluster**
   - Create Fargate cluster
   - Define task definition with environment variables
   - Create service with ALB

3. **Application Load Balancer**
   - Create ALB with HTTPS listener
   - Configure target groups
   - Set up SSL certificate (ACM)
   - Configure routing rules by subdomain

4. **Domain Setup**
   - Register domain (Route 53)
   - Create wildcard certificate: *.helpdeskapp.com
   - Configure DNS: *.helpdeskapp.com → ALB

### Phase 3: Landing Page Deployment

1. **Build Landing Page**
   ```bash
   cd landing-page
   npm run build
   ```

2. **S3 + CloudFront**
   - Upload build to S3
   - Create CloudFront distribution
   - Configure SSL certificate
   - Set up www.helpdeskapp.com

3. **Control Plane API**
   - Deploy separate ECS service for control plane
   - Configure api.helpdeskapp.com

### Phase 4: Monitoring & Logging

1. **CloudWatch**
   - Set up log groups for ECS tasks
   - Create alarms for CPU/Memory
   - Set up billing alerts

2. **AWS X-Ray**
   - Enable tracing for API calls
   - Monitor performance

## Cost Estimation

### Monthly AWS Costs (100 Active Tenants)

| Service | Instance | Cost |
|---------|----------|------|
| ECS Fargate | 2-4 tasks (0.5 vCPU, 1GB) | $30-60 |
| RDS PostgreSQL | db.t3.medium Multi-AZ | $120 |
| ElastiCache Redis | cache.t3.micro | $15 |
| S3 | ~50GB storage + requests | $5 |
| ALB | 1 load balancer | $20 |
| Data Transfer | ~100GB/month | $10 |
| Route 53 | Hosted zone + queries | $5 |
| CloudFront | Landing page CDN | $5 |
| **Total** | | **~$210-245/month** |

### Revenue Projection (100 Tenants)

- 20 Free tier: $0
- 50 Starter ($29): $1,450
- 25 Professional ($99): $2,475
- 5 Enterprise ($299): $1,495

**Total Revenue**: ~$5,420/month
**Profit Margin**: ~$5,175/month (95%)

### Break-even: ~5 paid tenants

## Security Considerations

1. **Tenant Isolation**
   - Database schemas prevent cross-tenant queries
   - Middleware validates tenant context on every request
   - S3 bucket policies enforce tenant-specific paths

2. **Authentication**
   - Control plane: Separate auth for portal users
   - Tenant apps: Existing JWT auth per tenant
   - API keys for programmatic access

3. **Data Protection**
   - Encryption at rest (RDS, S3)
   - Encryption in transit (TLS 1.3)
   - Regular automated backups

4. **Rate Limiting**
   - Per-tenant rate limits in Redis
   - DDoS protection with AWS Shield
   - WAF rules on ALB

5. **Compliance**
   - GDPR: Right to delete tenant data
   - Data residency: Multi-region support
   - Audit logs for all tenant operations

## Monitoring & Alerts

1. **Application Metrics**
   - Request rate per tenant
   - Error rate per tenant
   - Response time P95/P99
   - Credit consumption rate

2. **Infrastructure Metrics**
   - ECS task CPU/Memory
   - RDS connections, CPU, storage
   - Redis hit rate
   - ALB healthy host count

3. **Business Metrics**
   - New signups per day
   - Active tenants
   - Credit purchase volume
   - Churn rate

4. **Alerts**
   - Credit balance < 10% (email tenant)
   - Error rate > 5%
   - Database storage > 80%
   - High CPU/Memory usage

## Migration Path

### From Current Single-Tenant to Multi-Tenant

1. **Update Database Schema**
   - Add tenant management tables to public schema
   - Keep existing schema as template for tenants

2. **Add Tenant Middleware**
   - Implement tenant context extraction
   - Update all routes to use tenant-scoped Prisma client

3. **Build Control Plane**
   - Create landing page
   - Build tenant provisioning API
   - Integrate Stripe

4. **Deploy to AWS**
   - Follow deployment steps above
   - Migrate existing users to first tenant

5. **Test & Launch**
   - Provision 5 test tenants
   - Load test with 100 concurrent users per tenant
   - Soft launch with beta users

## Next Steps

1. ✅ Architecture design (this document)
2. [ ] Create landing page mockups
3. [ ] Update database schema for multi-tenancy
4. [ ] Implement tenant middleware
5. [ ] Build provisioning API
6. [ ] Create landing page (React/Next.js)
7. [ ] Set up AWS infrastructure (Terraform/CDK)
8. [ ] Deploy and test
9. [ ] Launch beta

## Questions to Resolve

1. **Domain Name**: Do you own a domain? (e.g., helpdeskapp.com)
2. **Branding**: Company name for the SaaS platform?
3. **Pricing**: Approve the credit pricing model above?
4. **Payment**: Stripe account ready?
5. **AWS Account**: AWS account set up?
6. **Launch Timeline**: When do you want to launch?

## References

- [AWS Multi-Tenant SaaS Architecture](https://aws.amazon.com/solutions/implementations/saas-on-aws/)
- [Prisma Multi-Schema](https://www.prisma.io/docs/guides/multi-schema)
- [ECS Best Practices](https://docs.aws.amazon.com/AmazonECS/latest/bestpracticesguide/intro.html)
