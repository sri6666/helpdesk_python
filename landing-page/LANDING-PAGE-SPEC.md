# Landing Page Specification

## Overview

Modern landing page and control portal for Helpdesk SaaS platform.

**Tech Stack:**
- React 18 + TypeScript
- Vite
- Tailwind CSS
- React Router
- Zustand (state management)
- Axios (API calls)

**Domain Structure:**
- `www.helpdeskapp.com` - Landing page & marketing
- `app.helpdeskapp.com` - User portal (dashboard, billing, instances)
- `api.helpdeskapp.com` - Control plane API
- `{tenant}.helpdeskapp.com` - Individual tenant helpdesk instances

## Pages

### 1. Homepage (`/`)

**Hero Section:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
┃                                              ┃
┃   Launch Your Helpdesk in Minutes           ┃
┃   Credit-based pricing. No commitments.     ┃
┃                                              ┃
┃   [Start Free Trial →]  [View Pricing]      ┃
┃                                              ┃
┃   ✓ 100 free credits  ✓ Setup in 30s        ┃
┃   ✓ No credit card required                 ┃
┃                                              ┃
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Features Section:**
- Multi-tenant architecture
- Instant provisioning
- Credit-based billing
- Full-featured helpdesk
- API access
- Custom branding
- Analytics & reporting
- Knowledge base

**How It Works:**
```
1. Sign Up (Free)
   └─ Create account, no credit card

2. Create Instance
   └─ Pick subdomain, choose plan

3. Start Helping
   └─ Your helpdesk is ready!
```

**Testimonials:**
- Customer success stories
- Usage statistics

**CTA:**
- "Start Free Trial" button

### 2. Pricing Page (`/pricing`)

**Plan Cards:**

```
┌─────────────────────────┐
│       FREE TIER         │
├─────────────────────────┤
│         $0/mo           │
├─────────────────────────┤
│ 100 credits/month       │
│ 1 agent                 │
│ 50 tickets/month        │
│ Email support           │
│                         │
│ [Start Free]            │
└─────────────────────────┘

┌─────────────────────────┐
│       STARTER           │
├─────────────────────────┤
│        $29/mo           │
├─────────────────────────┤
│ 1,000 credits/month     │
│ 5 agents                │
│ 500 tickets/month       │
│ Email + Chat support    │
│ Knowledge base          │
│ API access              │
│                         │
│ [Get Started]           │
└─────────────────────────┘

┌─────────────────────────┐
│    PROFESSIONAL         │
├─────────────────────────┤
│        $99/mo           │
├─────────────────────────┤
│ 10,000 credits/month    │
│ Unlimited agents        │
│ Unlimited tickets       │
│ Priority support        │
│ Custom branding         │
│ SLA guarantee           │
│ Automations             │
│                         │
│ [Get Started]           │
└─────────────────────────┘

┌─────────────────────────┐
│     ENTERPRISE          │
├─────────────────────────┤
│     Contact Sales       │
├─────────────────────────┤
│ Unlimited credits       │
│ Dedicated instance      │
│ Custom features         │
│ Dedicated support       │
│ Training & onboarding   │
│ SLA guarantee           │
│                         │
│ [Contact Us]            │
└─────────────────────────┘
```

**Credit Pricing Table:**

| Action | Credits |
|--------|---------|
| Create Ticket | 1 |
| Add Comment | 0.5 |
| Upload File (per MB) | 2 |
| Send Email | 0.1 |
| API Call | 0.1 |

**FAQs:**
- What are credits?
- Can I change plans?
- What happens when I run out of credits?
- Do unused credits roll over?

### 3. Signup Page (`/signup`)

**Step 1: Account Creation**
```
Create Your Account
━━━━━━━━━━━━━━━━━━

Full Name:     [_________________]
Email:         [_________________]
Password:      [_________________]
Confirm:       [_________________]

[Continue →]

Already have an account? [Login]
```

**Step 2: Create Instance**
```
Create Your Helpdesk
━━━━━━━━━━━━━━━━━━

Company Name:  [_________________]

Your Subdomain:
[___________].helpdeskapp.com
              ↑ Choose your subdomain

Select Plan:
○ Free Tier (100 credits/mo)
○ Starter ($29/mo - 1,000 credits)
○ Professional ($99/mo - 10,000 credits)

[Continue →]
```

**Step 3: Payment (if paid plan)**
```
Payment Details
━━━━━━━━━━━━━━━━

[Stripe Card Element]

Summary:
Professional Plan ............ $99.00/mo
10,000 credits/month

[Complete Setup →]
```

**Step 4: Provisioning**
```
Setting Up Your Helpdesk...
━━━━━━━━━━━━━━━━━━━━━━━━

✓ Creating your account
✓ Provisioning database
⟳ Initializing helpdesk...

Estimated time: 30 seconds

[Progress: ████████░░ 80%]
```

**Step 5: Success**
```
🎉 Your Helpdesk is Ready!
━━━━━━━━━━━━━━━━━━━━━━━

Your helpdesk is now live at:
https://acme.helpdeskapp.com

Login credentials have been sent to:
john@acme.com

[Go to My Helpdesk →]
[Visit Portal]
```

### 4. Login Page (`/login`)

```
Welcome Back
━━━━━━━━━━━━━━━━━━

Email:     [_________________]
Password:  [_________________]

☐ Remember me

[Login →]

Forgot password? | Don't have an account? [Sign up]
```

### 5. Portal Dashboard (`/portal`)

**After login, user sees:**

```
┌─────────────────────────────────────────────┐
│                                             │
│  Helpdesk Control Panel                    │
│  john@acme.com                 [Logout]     │
│                                             │
└─────────────────────────────────────────────┘

My Instances
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

┌──────────────────────────────────────────┐
│ Acme Helpdesk                            │
│ acme.helpdeskapp.com                     │
│                                          │
│ Status: ● Active                         │
│ Plan: Professional                       │
│ Credits: 8,423 / 10,000                  │
│                                          │
│ [Open Helpdesk]  [Manage]  [Billing]    │
└──────────────────────────────────────────┘

[+ Create New Instance]
```

### 6. Portal Billing (`/portal/billing`)

```
Billing & Credits
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Current Plan: Professional
━━━━━━━━━━━━━━━━━━━━━━━━

Monthly Price:        $99.00
Credits/month:        10,000
Credits remaining:    8,423
Resets on:           Feb 3, 2026

[Change Plan]  [Purchase Credits]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Credit Usage (Last 30 Days)
━━━━━━━━━━━━━━━━━━━━━━━━

[Line Chart showing daily credit consumption]

Recent Activity:
Jan 3  - Create Ticket (50 tickets) .... -50 credits
Jan 2  - Add Comment (120 comments) .... -60 credits
Jan 1  - Upload File (12 files) ........ -24 credits

[View Full History]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Payment Method
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Visa ending in 4242
Expires: 12/25

[Update Card]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Transaction History
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Jan 1, 2026  - Subscription ...... $99.00
Dec 1, 2025  - Subscription ...... $99.00
Nov 15, 2025 - Credit Purchase ... $50.00 (5,000 credits)

[Download Invoice] [View All]
```

### 7. Portal Instance Management (`/portal/instances/:id`)

```
Manage Instance: Acme Helpdesk
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Instance Details
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

URL:            acme.helpdeskapp.com
Company Name:   Acme Corp
Status:         ● Active
Created:        Dec 15, 2025

[Open Instance →]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Plan & Credits
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Current Plan:       Professional
Credits Remaining:  8,423 / 10,000
Reset Date:        Feb 3, 2026

[Change Plan]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Custom Domain
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Current: acme.helpdeskapp.com

Add custom domain:
[support.acme.com        ]

[Add Domain]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Branding
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Logo: [Upload Logo]
Primary Color: [#4F46E5]
Accent Color:  [#10B981]

[Save Changes]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Danger Zone
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Suspend Instance]  [Delete Instance]
```

## Components

### Reusable Components

1. **Navigation (`/src/components/Navigation.tsx`)**
   - Logo
   - Nav links (Features, Pricing, Docs, Login)
   - CTA button

2. **Footer (`/src/components/Footer.tsx`)**
   - Company links
   - Product links
   - Legal (Terms, Privacy, SLA)
   - Social media

3. **PricingCard (`/src/components/PricingCard.tsx`)**
   - Plan name, price
   - Feature list
   - CTA button
   - Popular badge

4. **InstanceCard (`/src/components/InstanceCard.tsx`)**
   - Instance name, URL
   - Status indicator
   - Credits bar
   - Action buttons

5. **CreditMeter (`/src/components/CreditMeter.tsx`)**
   - Progress bar
   - Remaining/total credits
   - Reset date

## API Integration

### Control Plane API Client

```typescript
// src/lib/controlApi.ts

import axios from 'axios';

const API_URL = import.meta.env.VITE_CONTROL_API_URL || 'http://localhost:3000/api/control';

export const controlApi = {
  // Auth
  signup: (data: SignupData) => axios.post(`${API_URL}/signup`, data),
  login: (email: string, password: string) => axios.post(`${API_URL}/login`, { email, password }),

  // Tenants
  provisionTenant: (data: TenantData) => axios.post(`${API_URL}/tenants/provision`, data),
  getTenants: (userId: string) => axios.get(`${API_URL}/tenants?userId=${userId}`),
  getTenantStatus: (tenantId: string) => axios.get(`${API_URL}/tenants/${tenantId}/status`),

  // Plans
  getPlans: () => axios.get(`${API_URL}/plans`),

  // Credits
  purchaseCredits: (data: CreditPurchase) => axios.post(`${API_URL}/credits/purchase`, data),
};
```

## State Management

### Auth Store

```typescript
// src/stores/authStore.ts

import create from 'zustand';

interface AuthStore {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (data: SignupData) => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  token: localStorage.getItem('controlToken'),

  login: async (email, password) => {
    const response = await controlApi.login(email, password);
    const { token, user } = response.data;

    localStorage.setItem('controlToken', token);
    set({ user, token });
  },

  signup: async (data) => {
    const response = await controlApi.signup(data);
    // Auto-login after signup
    await useAuthStore.getState().login(data.email, data.password);
  },

  logout: () => {
    localStorage.removeItem('controlToken');
    set({ user: null, token: null });
  },
}));
```

### Tenant Store

```typescript
// src/stores/tenantStore.ts

import create from 'zustand';

interface TenantStore {
  tenants: Tenant[];
  currentTenant: Tenant | null;
  fetchTenants: (userId: string) => Promise<void>;
  provisionTenant: (data: TenantData) => Promise<Tenant>;
}

export const useTenantStore = create<TenantStore>((set, get) => ({
  tenants: [],
  currentTenant: null,

  fetchTenants: async (userId) => {
    const response = await controlApi.getTenants(userId);
    set({ tenants: response.data.tenants });
  },

  provisionTenant: async (data) => {
    const response = await controlApi.provisionTenant(data);
    const tenant = response.data.tenant;

    // Poll for provisioning status
    await pollTenantStatus(tenant.id);

    // Refresh tenant list
    await get().fetchTenants(data.userId);

    return tenant;
  },
}));
```

## Deployment

### Build for Production

```bash
cd landing-page
npm run build
```

Output: `dist/` folder with static files

### Deploy to S3 + CloudFront

```bash
# Upload to S3
aws s3 sync dist/ s3://www-helpdeskapp-com/ --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id E1234567890ABC \
  --paths "/*"
```

### Environment Variables

```env
# .env.production
VITE_CONTROL_API_URL=https://api.helpdeskapp.com/api/control
VITE_DOMAIN=helpdeskapp.com
VITE_STRIPE_PUBLIC_KEY=pk_live_xxx
```

## Next Steps

1. Build React components for each page
2. Implement Stripe payment integration
3. Add email verification flow
4. Create password reset functionality
5. Add analytics tracking (Google Analytics, Mixpanel)
6. Implement error tracking (Sentry)
7. Add live chat support widget
8. Create admin panel for super admin
9. Build mobile-responsive design
10. Add A/B testing framework

## Design System

**Colors:**
- Primary: #4F46E5 (Indigo)
- Secondary: #10B981 (Green)
- Accent: #F59E0B (Amber)
- Success: #10B981
- Error: #EF4444
- Warning: #F59E0B
- Info: #3B82F6

**Typography:**
- Headings: Inter (font-weight: 700)
- Body: Inter (font-weight: 400)
- Code: Fira Code

**Spacing:**
- Base unit: 4px
- Padding: 16px, 24px, 32px
- Margins: 16px, 32px, 64px

**Breakpoints:**
- Mobile: < 640px
- Tablet: 640px - 1024px
- Desktop: > 1024px

## Metrics to Track

1. **Conversion Funnel:**
   - Homepage visitors
   - Signup page visits
   - Completed signups
   - Provisioned instances
   - Active users after 7 days

2. **Revenue Metrics:**
   - MRR (Monthly Recurring Revenue)
   - ARR (Annual Recurring Revenue)
   - Average revenue per user (ARPU)
   - Customer lifetime value (LTV)
   - Churn rate

3. **Usage Metrics:**
   - Credits consumed per tenant
   - Most common actions
   - API usage
   - Feature adoption

4. **Performance:**
   - Page load time
   - Time to provision instance
   - API response times
