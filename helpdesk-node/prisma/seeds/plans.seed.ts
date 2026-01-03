import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function seedPlans() {
  console.log('🌱 Seeding SaaS plans...');

  const plans = [
    {
      name: 'free',
      displayName: 'Free Tier',
      description: 'Perfect for trying out our helpdesk platform',
      priceMonthly: 0,
      priceAnnual: 0,
      creditsMonthly: 100,
      creditsAnnual: 100,
      maxAgents: 1,
      maxTickets: 50, // per month
      maxStorage: 100, // MB
      features: {
        tickets: true,
        comments: true,
        attachments: true,
        knowledgeBase: false,
        apiAccess: false,
        customBranding: false,
        prioritySupport: false,
        sla: false,
        analytics: false,
        integrations: false,
      },
      stripePriceIdMonthly: null,
      stripePriceIdAnnual: null,
      isActive: true,
    },
    {
      name: 'starter',
      displayName: 'Starter Plan',
      description: 'Great for small teams getting started with helpdesk',
      priceMonthly: 2900, // $29.00
      priceAnnual: 29000, // $290.00 (2 months free)
      creditsMonthly: 1000,
      creditsAnnual: 12000,
      maxAgents: 5,
      maxTickets: 500, // per month
      maxStorage: 5000, // 5GB
      features: {
        tickets: true,
        comments: true,
        attachments: true,
        knowledgeBase: true,
        apiAccess: true,
        customBranding: false,
        prioritySupport: false,
        sla: false,
        analytics: true,
        integrations: true,
        emailSupport: true,
        chatSupport: true,
      },
      stripePriceIdMonthly: 'price_starter_monthly', // Replace with actual Stripe price ID
      stripePriceIdAnnual: 'price_starter_annual',
      isActive: true,
    },
    {
      name: 'professional',
      displayName: 'Professional Plan',
      description: 'For growing businesses with advanced needs',
      priceMonthly: 9900, // $99.00
      priceAnnual: 99000, // $990.00 (2 months free)
      creditsMonthly: 10000,
      creditsAnnual: 120000,
      maxAgents: null, // unlimited
      maxTickets: null, // unlimited
      maxStorage: 50000, // 50GB
      features: {
        tickets: true,
        comments: true,
        attachments: true,
        knowledgeBase: true,
        apiAccess: true,
        customBranding: true,
        prioritySupport: true,
        sla: true,
        analytics: true,
        integrations: true,
        emailSupport: true,
        chatSupport: true,
        automations: true,
        customFields: true,
        workflows: true,
      },
      stripePriceIdMonthly: 'price_professional_monthly',
      stripePriceIdAnnual: 'price_professional_annual',
      isActive: true,
    },
    {
      name: 'enterprise',
      displayName: 'Enterprise Plan',
      description: 'Custom solutions for large organizations',
      priceMonthly: 0, // Custom pricing - contact sales
      priceAnnual: 0,
      creditsMonthly: 999999, // Effectively unlimited
      creditsAnnual: 9999999,
      maxAgents: null, // unlimited
      maxTickets: null, // unlimited
      maxStorage: null, // unlimited
      features: {
        tickets: true,
        comments: true,
        attachments: true,
        knowledgeBase: true,
        apiAccess: true,
        customBranding: true,
        prioritySupport: true,
        sla: true,
        analytics: true,
        integrations: true,
        emailSupport: true,
        chatSupport: true,
        automations: true,
        customFields: true,
        workflows: true,
        dedicatedInstance: true,
        customFeatures: true,
        dedicatedSupport: true,
        slaGuarantee: true,
        trainingSession: true,
        onboarding: true,
      },
      stripePriceIdMonthly: null, // Custom pricing
      stripePriceIdAnnual: null,
      isActive: true,
    },
  ];

  for (const planData of plans) {
    const existing = await prisma.plan.findUnique({
      where: { name: planData.name },
    });

    if (existing) {
      console.log(`  ⏭️  Plan "${planData.displayName}" already exists, skipping...`);
      continue;
    }

    await prisma.plan.create({
      data: planData,
    });

    console.log(`  ✅ Created plan: ${planData.displayName}`);
  }

  console.log('✅ Plans seeded successfully\n');
}

// Run seed if called directly
if (require.main === module) {
  seedPlans()
    .catch((e) => {
      console.error('❌ Error seeding plans:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
