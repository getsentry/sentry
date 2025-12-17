import {MetricHistoryFixture} from 'getsentry-test/fixtures/metricHistory';
import {PlanDetailsLookupFixture} from 'getsentry-test/fixtures/planDetailsLookup';
import {
  DynamicSamplingReservedBudgetFixture,
  ReservedBudgetMetricHistoryFixture,
  SeerReservedBudgetFixture,
} from 'getsentry-test/fixtures/reservedBudget';

import {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';

import {RESERVED_BUDGET_QUOTA} from 'getsentry/constants';
import type {Plan, Subscription as TSubscription} from 'getsentry/types';
import {AddOnCategory, BillingType} from 'getsentry/types';
import {isEnterprise, isTrialPlan} from 'getsentry/utils/billing';

type Props = Partial<TSubscription> & {organization: Organization};

export function SubscriptionFixture(props: Props): TSubscription {
  const {organization, ...params} = props;
  const planData = {plan: 'am1_f', ...params};

  // Use planDetails from params if provided, otherwise look it up
  const planDetails = (planData.planDetails ||
    PlanDetailsLookupFixture(planData.plan)) as Plan;

  const hasPerformance = planDetails?.categories?.includes(DataCategory.TRANSACTIONS);
  const hasReplays = planDetails?.categories?.includes(DataCategory.REPLAYS);
  const hasMonitors = planDetails?.categories?.includes(DataCategory.MONITOR_SEATS);
  const hasUptime = planDetails?.categories?.includes(DataCategory.UPTIME);
  const hasSpans = planDetails?.categories?.includes(DataCategory.SPANS);
  const hasSpansIndexed = planDetails?.categories?.includes(DataCategory.SPANS_INDEXED);
  const hasProfileDuration = planDetails?.categories?.includes(
    DataCategory.PROFILE_DURATION
  );
  const hasProfileDurationUI = planDetails?.categories?.includes(
    DataCategory.PROFILE_DURATION_UI
  );
  const hasAttachments = planDetails?.categories?.includes(DataCategory.ATTACHMENTS);
  const hasLogBytes = planDetails?.categories?.includes(DataCategory.LOG_BYTE);
  const hasLegacySeer = AddOnCategory.LEGACY_SEER in planDetails.addOnCategories;
  const hasSeer = AddOnCategory.SEER in planDetails.addOnCategories;

  // Create a safe default for planCategories if it doesn't exist
  const safeCategories = planDetails?.planCategories || {};

  const isTrial = isTrialPlan(planDetails.id);
  const isEnterpriseTrial = isTrial && isEnterprise(planDetails.id);
  const reservedBudgets = [];
  if (hasLegacySeer) {
    if (isTrial) {
      reservedBudgets.push(SeerReservedBudgetFixture({reservedBudget: 150_00}));
    } else {
      reservedBudgets.push(SeerReservedBudgetFixture({reservedBudget: 0}));
    }
  }

  const addOns: TSubscription['addOns'] = {};
  Object.values(planDetails.addOnCategories).forEach(addOnCategory => {
    addOns[addOnCategory.apiName] = {
      ...addOnCategory,
      enabled: isTrial,
      isAvailable: addOnCategory.apiName in planDetails.addOnCategories,
    };
  });

  return {
    customPrice: null,
    customPricePcss: null,
    hasDismissedForcedTrialNotice: false,
    hasDismissedTrialEndingNotice: false,
    hasOverageNotificationsDisabled: false,
    hasRestrictedIntegration: false,
    hadCustomDynamicSampling: false,
    id: '',
    isBundleEligible: false,
    isEnterpriseTrial,
    isExemptFromForcedTrial: false,
    isForcedTrial: false,
    isOverMemberLimit: false,
    isPartner: false,
    isSelfServePartner: false,
    isPerformancePlanTrial: false,
    lastTrialEnd: null,
    spendAllocationEnabled: false,
    status: 'active',
    totalProjects: 0,
    trialPlan: null,
    trialTier: null,
    onDemandPeriodStart: '2018-09-25',
    gracePeriodStart: null,
    trialEnd: null,
    countryCode: null,
    cancelAtPeriodEnd: false,
    isTrial,
    paymentSource: {
      last4: '4242',
      countryCode: 'US',
      zipCode: '94242',
      expMonth: 12,
      expYear: 2077,
      brand: 'Visa',
    },
    billingPeriodEnd: '2018-10-24',
    onDemandSpendUsed: 0,
    renewalDate: '2018-10-25',
    partner: null,
    planDetails,
    totalMembers: 1,
    contractInterval: 'monthly',
    canGracePeriod: true,
    totalLicenses: 1,
    billingPeriodStart: '2018-09-25',
    suspensionReason: null,
    planTier: 'am1',
    accountBalance: -10000,
    companyName: null,
    isSuspended: false,
    isSponsored: false,
    sponsoredType: null,
    isFree: true,
    billingEmail: null,
    gdprDetails: null,
    canCancel: false,
    canSelfServe: true,
    supportsOnDemand: true,
    usedLicenses: 1,
    membersDeactivatedFromLimit: 0,
    type: BillingType.CREDIT_CARD,
    hasSoftCap: false,
    isPastDue: false,
    onDemandDisabled: false,
    onDemandInvoiced: false,
    gracePeriodEnd: null,
    contractPeriodStart: '2018-09-25',
    onDemandMaxSpend: 0,
    productTrials: [],
    isManaged: false,
    contractPeriodEnd: '2018-10-24',
    canTrial: true,
    slug: organization.slug,
    pendingChanges: null,
    usageExceeded: false,
    isHeroku: false,
    name: organization.name,
    billingInterval: planDetails.billingInterval || 'monthly',
    contactInfo: null,
    dateJoined: '2018-09-10T23:58:10.167Z',
    vatStatus: null,
    isGracePeriod: false,
    onDemandPeriodEnd: '2018-10-24',
    vatID: null,
    msaUpdatedForDataConsent: false,
    dataRetention: null,
    orgRetention: {standard: null, downsampled: null},
    addOns,
    reservedBudgets,
    categories: {
      errors: MetricHistoryFixture({
        category: DataCategory.ERRORS,
        reserved: safeCategories.errors?.[0]?.events || 5000,
        prepaid: safeCategories.errors?.[0]?.events || 5000,
        order: 1,
      }),
      ...(hasPerformance && {
        transactions: MetricHistoryFixture({
          category: DataCategory.TRANSACTIONS,
          reserved: safeCategories.transactions?.[0]?.events || 10000,
          prepaid: safeCategories.transactions?.[0]?.events || 10000,
          order: 2,
        }),
      }),
      ...(hasReplays && {
        replays: MetricHistoryFixture({
          category: DataCategory.REPLAYS,
          reserved: safeCategories.replays?.[0]?.events || 500,
          prepaid: safeCategories.replays?.[0]?.events || 500,
          order: 4,
        }),
      }),
      ...(hasSpans && {
        spans: MetricHistoryFixture({
          category: DataCategory.SPANS,
          reserved: safeCategories.spans?.[0]?.events || 10000000,
          prepaid: safeCategories.spans?.[0]?.events || 10000000,
          order: 5,
        }),
      }),
      ...(hasSpansIndexed && {
        spansIndexed: MetricHistoryFixture({
          category: DataCategory.SPANS_INDEXED,
          reserved: safeCategories.spans?.[0]?.events || 10000000,
          prepaid: safeCategories.spans?.[0]?.events || 10000000,
          order: 6,
        }),
      }),
      ...(hasMonitors && {
        monitorSeats: MetricHistoryFixture({
          category: DataCategory.MONITOR_SEATS,
          reserved: safeCategories.monitorSeats?.[0]?.events || 1,
          prepaid: safeCategories.monitorSeats?.[0]?.events || 1,
          order: 7,
        }),
      }),
      ...(hasUptime && {
        uptime: MetricHistoryFixture({
          category: DataCategory.UPTIME,
          reserved: safeCategories.uptime?.[0]?.events || 1,
          prepaid: safeCategories.uptime?.[0]?.events || 1,
          order: 8,
        }),
      }),
      ...(hasAttachments && {
        attachments: MetricHistoryFixture({
          category: DataCategory.ATTACHMENTS,
          reserved: safeCategories.attachments?.[0]?.events || 1,
          prepaid: safeCategories.attachments?.[0]?.events || 1,
          order: 9,
        }),
      }),
      ...(hasLogBytes && {
        logBytes: MetricHistoryFixture({
          category: DataCategory.LOG_BYTE,
          reserved: safeCategories.logBytes?.[0]?.events || 0,
          prepaid: safeCategories.logBytes?.[0]?.events || 0,
          order: 12,
        }),
      }),
      ...(hasProfileDuration && {
        profileDuration: MetricHistoryFixture({
          category: DataCategory.PROFILE_DURATION,
          reserved: safeCategories.profileDuration?.[0]?.events || 0,
          prepaid: safeCategories.profileDuration?.[0]?.events || 0,
          order: 10,
        }),
      }),
      ...(hasProfileDurationUI && {
        profileDurationUI: MetricHistoryFixture({
          category: DataCategory.PROFILE_DURATION_UI,
          reserved: safeCategories.profileDurationUI?.[0]?.events || 0,
          prepaid: safeCategories.profileDurationUI?.[0]?.events || 0,
          order: 11,
        }),
      }),
      ...(hasLegacySeer && {
        seerAutofix: MetricHistoryFixture({
          category: DataCategory.SEER_AUTOFIX,
          reserved: 0,
          prepaid: 0,
          order: 14,
        }),
        seerScanner: MetricHistoryFixture({
          category: DataCategory.SEER_SCANNER,
          reserved: 0,
          prepaid: 0,
          order: 15,
        }),
      }),
      ...(hasSeer && {
        seerUsers: MetricHistoryFixture({
          category: DataCategory.SEER_USER,
          reserved: 0,
          prepaid: 0,
          order: 16,
        }),
      }),
    },
    effectiveRetentions: {},
    ...planData,
  };
}

/**
 * Returns a subscription with self-serve paid Seer reserved budget.
 */
export function SubscriptionWithLegacySeerFixture(props: Props): TSubscription {
  const subscription = SubscriptionFixture(props);
  if (!subscription.planDetails.addOnCategories[AddOnCategory.LEGACY_SEER]) {
    return subscription;
  }

  subscription.categories = {
    ...subscription.categories,
    seerAutofix: MetricHistoryFixture({
      category: DataCategory.SEER_AUTOFIX,
      reserved: RESERVED_BUDGET_QUOTA,
      prepaid: RESERVED_BUDGET_QUOTA,
      order: 27,
    }),
    seerScanner: MetricHistoryFixture({
      category: DataCategory.SEER_SCANNER,
      reserved: RESERVED_BUDGET_QUOTA,
      prepaid: RESERVED_BUDGET_QUOTA,
      order: 28,
    }),
  };
  if (subscription.categories.seerUsers) {
    delete subscription.categories.seerUsers;
  }
  subscription.reservedBudgets = [SeerReservedBudgetFixture({})];
  subscription.addOns = {
    ...subscription.addOns,
    [AddOnCategory.LEGACY_SEER]: {
      ...(subscription.addOns?.[AddOnCategory.LEGACY_SEER] ??
        subscription.planDetails.addOnCategories[AddOnCategory.LEGACY_SEER]),
      enabled: true,
      isAvailable: true,
    },
  };
  if (subscription.addOns?.[AddOnCategory.SEER]) {
    subscription.addOns[AddOnCategory.SEER].enabled = false;
    subscription.addOns[AddOnCategory.SEER].isAvailable = false;
    delete subscription.categories.seerUsers;
  }
  return subscription;
}

export function InvoicedSubscriptionFixture(props: Props): TSubscription {
  const planData = {plan: 'am2_business_ent_auf', planTier: 'am2', ...props};
  const planDetails = PlanDetailsLookupFixture(planData.plan);
  const subscription = SubscriptionFixture({
    ...props,
    planDetails,
    plan: planDetails?.id,
    planTier: planData.planTier,
    canSelfServe: false,
    type: BillingType.INVOICED,
    channel: 'sales',
    accountBalance: 0,
    isFree: false,
  });

  return subscription;
}

export function Am3DsEnterpriseSubscriptionFixture(props: Props): TSubscription {
  const {organization: _organization, ...params} = props;
  const planData = {plan: 'am3_business_ent_ds_auf', ...params};

  const subscription = InvoicedSubscriptionFixture({
    ...props,
    plan: planData.plan,
    planTier: planData.planTier,
  });
  subscription.reservedBudgets = [
    ...(subscription.reservedBudgets || []),
    DynamicSamplingReservedBudgetFixture({
      id: '11',
      reservedBudget: 100_000_00,
      totalReservedSpend: 60_000_00,
      freeBudget: 0,
      percentUsed: 0.6,
      categories: {
        spans: ReservedBudgetMetricHistoryFixture({
          reservedCpe: 1,
          reservedSpend: 40_000_00,
        }),
        spansIndexed: ReservedBudgetMetricHistoryFixture({
          reservedCpe: 2,
          reservedSpend: 20_000_00,
        }),
      },
    }),
  ];
  subscription.categories.spans!.reserved = RESERVED_BUDGET_QUOTA;
  subscription.categories.spansIndexed!.reserved = RESERVED_BUDGET_QUOTA;

  return subscription;
}
