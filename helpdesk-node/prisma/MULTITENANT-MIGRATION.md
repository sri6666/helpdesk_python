# Multi-Tenant Schema Migration Guide

## Overview

This guide explains how to migrate from single-tenant to multi-tenant architecture.

## Schema Structure

### Two-Schema Approach

1. **Public Schema** (Control Plane)
   - Manages SaaS platform
   - Tenant accounts
   - Billing & credits
   - Usage tracking
   - Subscriptions

2. **Tenant Schemas** (Per Tenant)
   - Each tenant gets isolated schema
   - Contains helpdesk data (tickets, users, etc.)
   - Schema name format: `tenant_{uuid}`

## Migration Steps

### Step 1: Backup Current Database

```bash
# Backup existing database
pg_dump -U postgres helpdesk > backup_$(date +%Y%m%d).sql
```

### Step 2: Create Control Plane Schema

Since we're using the multi-schema approach, we need to:

1. Keep existing schema as template
2. Add control plane tables to public schema

```bash
# Generate Prisma client for multi-tenant schema
cd helpdesk-node
cp prisma/schema-multitenant.prisma prisma/schema.prisma
npx prisma generate
```

### Step 3: Run Migrations

```bash
# Create migration for control plane
npx prisma migrate dev --name add-multitenant-support

# This will create:
# - control_users
# - tenants
# - credits
# - usage_logs
# - transactions
# - plans
# - invitations
```

### Step 4: Seed Plans

```bash
# Run seed script to populate plans
npx prisma db seed
```

### Step 5: Create First Tenant

```typescript
// Example: Create first tenant from existing data
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateSingleTenantToMulti() {
  // 1. Create control user
  const controlUser = await prisma.controlUser.create({
    data: {
      email: 'admin@example.com',
      passwordHash: 'hashed_password',
      fullName: 'Admin User',
      emailVerified: true,
    },
  });

  // 2. Create first tenant
  const tenant = await prisma.tenant.create({
    data: {
      userId: controlUser.id,
      companyName: 'My Company',
      subdomain: 'mycompany',
      schemaName: 'tenant_main',
      plan: 'professional',
      status: 'active',
    },
  });

  // 3. Create credits
  await prisma.credits.create({
    data: {
      tenantId: tenant.id,
      balance: 10000,
      plan: 'professional',
      monthlyAllocation: 10000,
      resetAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    },
  });

  // 4. Create schema for tenant
  await prisma.$executeRaw`CREATE SCHEMA tenant_main`;

  // 5. Run migrations in tenant schema
  // This requires custom logic - see below
}
```

### Step 6: Migrate Existing Data to Tenant Schema

```bash
# Copy existing tables to tenant schema
psql -U postgres helpdesk <<EOF
-- Create tenant schema
CREATE SCHEMA IF NOT EXISTS tenant_main;

-- Copy all tables to tenant schema
CREATE TABLE tenant_main.users AS SELECT * FROM public.users;
CREATE TABLE tenant_main.tickets AS SELECT * FROM public.tickets;
CREATE TABLE tenant_main.comments AS SELECT * FROM public.comments;
-- ... copy all tenant tables

-- Recreate indexes and constraints in tenant schema
-- (This requires running the full migration)
EOF
```

## Schema Switching Strategy

### Approach 1: Connection String with Schema Parameter

```typescript
// Get Prisma client for specific tenant
function getTenantPrisma(schemaName: string) {
  return new PrismaClient({
    datasources: {
      db: {
        url: `${process.env.DATABASE_URL}?schema=${schemaName}`,
      },
    },
  });
}

// Usage in request handler
const tenantPrisma = getTenantPrisma(req.tenant.schemaName);
const tickets = await tenantPrisma.ticket.findMany();
```

### Approach 2: SET search_path (Recommended)

```typescript
// Middleware to set schema context
async function setTenantContext(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const tenant = req.tenant; // From tenant middleware

  // Set search path for this connection
  await prisma.$executeRaw`SET search_path TO ${tenant.schemaName}, public`;

  next();
}
```

### Approach 3: Prisma Client Extensions (Advanced)

```typescript
// Create tenant-aware Prisma client
const tenantPrisma = prisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ args, query }) {
        // Automatically set schema based on context
        const schema = getTenantSchemaFromContext();
        await prisma.$executeRaw`SET search_path TO ${schema}`;
        return query(args);
      },
    },
  },
});
```

## Running Migrations for New Tenants

When provisioning a new tenant, you need to:

1. Create the schema
2. Run all tenant migrations in that schema

```typescript
async function provisionTenantDatabase(schemaName: string) {
  // 1. Create schema
  await prisma.$executeRaw`CREATE SCHEMA ${Prisma.raw(schemaName)}`;

  // 2. Get all migration SQL files
  const migrationDir = './prisma/migrations';
  const migrations = await fs.readdir(migrationDir);

  // 3. Run each migration in the new schema
  for (const migration of migrations) {
    const sql = await fs.readFile(`${migrationDir}/${migration}/migration.sql`, 'utf8');

    // Replace 'tenant' schema with actual tenant schema
    const tenantSql = sql.replace(/@@schema\("tenant"\)/g, `@@schema("${schemaName}")`);

    // Execute in tenant schema
    await prisma.$executeRawUnsafe(tenantSql);
  }

  console.log(`Provisioned database for schema: ${schemaName}`);
}
```

## Alternative: Use Separate Databases

Instead of schemas, you can use separate databases per tenant:

```typescript
// Each tenant gets own database
const tenantDbUrl = `postgresql://user:pass@localhost:5432/helpdesk_${tenant.subdomain}`;

const tenantPrisma = new PrismaClient({
  datasources: {
    db: { url: tenantDbUrl },
  },
});
```

**Pros:**
- Complete isolation
- Easier backups per tenant
- Better for large tenants

**Cons:**
- More expensive (resources per DB)
- Harder to manage at scale
- Connection pool limits

**Recommendation:** Start with schema-per-tenant, move high-value tenants to dedicated databases later.

## Testing Multi-Tenant Setup

```typescript
// Test script
async function testMultiTenant() {
  // 1. Create test tenant
  const tenant = await prisma.tenant.create({
    data: {
      userId: 'test-user-id',
      companyName: 'Test Corp',
      subdomain: 'testcorp',
      schemaName: 'tenant_test',
      plan: 'starter',
      status: 'active',
    },
  });

  // 2. Provision schema
  await provisionTenantDatabase('tenant_test');

  // 3. Create test data in tenant schema
  const tenantPrisma = new PrismaClient({
    datasources: {
      db: {
        url: `${process.env.DATABASE_URL}?schema=tenant_test`,
      },
    },
  });

  const user = await tenantPrisma.user.create({
    data: {
      email: 'test@testcorp.com',
      password: 'hashed',
      fullName: 'Test User',
      userType: 'ADMIN',
    },
  });

  console.log('✅ Multi-tenant test successful', { tenant, user });

  // 4. Cleanup
  await tenantPrisma.$disconnect();
  await prisma.$executeRaw`DROP SCHEMA tenant_test CASCADE`;
  await prisma.tenant.delete({ where: { id: tenant.id } });
}
```

## Environment Variables

Update your `.env` file:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/helpdesk_saas"

# Control Plane
CONTROL_PLANE_URL="https://api.helpdeskapp.com"
CONTROL_PLANE_SECRET="your-secret-key"

# Tenant Settings
DEFAULT_TENANT_SCHEMA_PREFIX="tenant_"
MAX_TENANTS_PER_DATABASE=1000

# Feature Flags
ENABLE_MULTI_TENANCY=true
ENABLE_TENANT_ISOLATION=true
```

## Rollback Plan

If you need to rollback:

```bash
# 1. Restore from backup
psql -U postgres helpdesk < backup_20250103.sql

# 2. Or revert migration
npx prisma migrate reset

# 3. Restore old schema
cp prisma/schema.prisma.backup prisma/schema.prisma
npx prisma generate
```

## Performance Considerations

1. **Connection Pooling**
   - Use PgBouncer for connection pooling
   - Limit connections per schema
   - Monitor active connections

2. **Query Performance**
   - Ensure indexes exist in each tenant schema
   - Use `EXPLAIN ANALYZE` to optimize queries
   - Monitor slow queries per tenant

3. **Resource Limits**
   - Set statement_timeout per tenant
   - Limit disk space per schema
   - Monitor memory usage

4. **Scaling**
   - Start with 100-500 tenants per database
   - Shard tenants across multiple databases when needed
   - Use read replicas for reporting

## Security Checklist

- [ ] Each tenant can only access their schema
- [ ] Tenant middleware validates subdomain
- [ ] SQL injection protection (parameterized queries)
- [ ] Row-level security (RLS) as backup
- [ ] Audit logs for cross-tenant access attempts
- [ ] Regular security audits
- [ ] Encrypted backups per tenant

## Monitoring

Key metrics to track:

1. **Per Tenant**
   - Active connections
   - Query latency
   - Storage used
   - Credits consumed

2. **Platform-wide**
   - Total active tenants
   - Provisioning time
   - Failed queries
   - Resource utilization

## Next Steps

1. Implement tenant middleware
2. Create provisioning API
3. Set up monitoring
4. Test with multiple tenants
5. Load testing
6. Security audit
