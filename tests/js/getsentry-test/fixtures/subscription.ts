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
import {BillingType} from 'getsentry/types';

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

  // Create a safe default for planCategories if it doesn't exist
  const safeCategories = planDetails?.planCategories || {};
  const defaultErrorEvents = safeCategories.errors?.[0]?.events || 5000;

  return {
    customPrice: null,
    customPriceAttachments: null,
    customPriceErrors: null,
    customPricePcss: null,
    customPriceTransactions: null,
    hasDismissedForcedTrialNotice: false,
    hasDismissedTrialEndingNotice: false,
    hasOverageNotificationsDisabled: false,
    hasRestrictedIntegration: false,
    hadCustomDynamicSampling: false,
    id: '',
    isBundleEligible: false,
    isEnterpriseTrial: false,
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
    isTrial: false,
    paymentSource: {
      last4: '4242',
      countryCode: 'US',
      zipCode: '94242',
      expMonth: 12,
      expYear: 2077,
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
    reservedEvents: defaultErrorEvents,
    hasSoftCap: false,
    isPastDue: false,
    onDemandDisabled: false,
    onDemandInvoiced: false,
    gracePeriodEnd: null,
    contractPeriodStart: '2018-09-25',
    prepaidEventsAllowed: 5000,
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
    billingInterval: 'monthly',
    contactInfo: null,
    dateJoined: '2018-09-10T23:58:10.167Z',
    vatStatus: null,
    isGracePeriod: false,
    onDemandPeriodEnd: '2018-10-24',
    vatID: null,
    reservedErrors: 5_000,
    reservedTransactions: 10_000,
    reservedAttachments: 1,
    msaUpdatedForDataConsent: false,
    dataRetention: null,
    hasReservedBudgets: false,
    reservedBudgetCategories: [],
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
    },
    ...planData,
  };
}

export function SubscriptionWithSeerFixture(props: Props): TSubscription {
  const subscription = SubscriptionFixture(props);
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
  subscription.reservedBudgetCategories = [
    DataCategory.SEER_AUTOFIX,
    DataCategory.SEER_SCANNER,
  ];
  subscription.reservedBudgets = [SeerReservedBudgetFixture({})];
  return subscription;
}

export function InvoicedSubscriptionFixture(props: Props): TSubscription {
  const {organization, ...params} = props;
  const planData = {plan: 'am2_business_ent_auf', ...params};
  const planDetails = PlanDetailsLookupFixture(planData.plan);

  const hasErrors = planDetails?.categories?.includes(DataCategory.ERRORS);
  const hasPerformance = planDetails?.categories?.includes(DataCategory.TRANSACTIONS);
  const hasReplays = planDetails?.categories?.includes(DataCategory.REPLAYS);
  const hasMonitors = planDetails?.categories?.includes(DataCategory.MONITOR_SEATS);
  const hasSpans = planDetails?.categories?.includes(DataCategory.SPANS);
  const hasAttachments = planDetails?.categories?.includes(DataCategory.ATTACHMENTS);

  return {
    customPrice: null,
    customPriceAttachments: null,
    customPriceErrors: null,
    customPricePcss: null,
    customPriceTransactions: null,
    hasDismissedForcedTrialNotice: false,
    hasDismissedTrialEndingNotice: false,
    hasOverageNotificationsDisabled: false,
    hasRestrictedIntegration: false,
    hadCustomDynamicSampling: false,
    id: '',
    isBundleEligible: false,
    isEnterpriseTrial: false,
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
    onDemandPeriodStart: '2024-04-03',
    gracePeriodStart: null,
    trialEnd: null,
    countryCode: null,
    cancelAtPeriodEnd: false,
    isTrial: false,
    paymentSource: {
      last4: '4242',
      countryCode: 'US',
      zipCode: '94242',
      expMonth: 12,
      expYear: 2077,
    },
    billingPeriodEnd: '2025-04-02',
    onDemandSpendUsed: 0,
    renewalDate: '2025-04-03',
    partner: null,
    planDetails: planDetails!,
    totalMembers: 1,
    contractInterval: 'annual',
    canGracePeriod: true,
    totalLicenses: 1,
    billingPeriodStart: '2024-04-03',
    suspensionReason: null,
    planTier: 'am2',
    accountBalance: 0,
    companyName: null,
    isSuspended: false,
    isSponsored: false,
    sponsoredType: null,
    isFree: true,
    billingEmail: null,
    gdprDetails: null,
    canCancel: false,
    canSelfServe: false,
    supportsOnDemand: false,
    usedLicenses: 1,
    membersDeactivatedFromLimit: 0,
    type: BillingType.INVOICED,
    reservedEvents: 50_000,
    hasSoftCap: false,
    isPastDue: false,
    onDemandDisabled: false,
    onDemandInvoiced: false,
    onDemandInvoicedManual: false,
    gracePeriodEnd: null,
    contractPeriodStart: '2024-04-03',
    prepaidEventsAllowed: 50_000,
    onDemandMaxSpend: 0,
    isManaged: false,
    contractPeriodEnd: '2025-04-02',
    canTrial: true,
    slug: organization.slug,
    pendingChanges: null,
    usageExceeded: false,
    isHeroku: false,
    name: organization.name,
    billingInterval: 'annual',
    contactInfo: null,
    dateJoined: '2018-09-10T23:58:10.167Z',
    vatStatus: null,
    isGracePeriod: false,
    onDemandPeriodEnd: '2024-05-02',
    vatID: null,
    reservedErrors: 50_000,
    reservedTransactions: 100_000,
    reservedAttachments: 1,
    dataRetention: null,
    hasReservedBudgets: false,
    reservedBudgetCategories: [],
    categories: {
      ...(hasErrors && {
        errors: MetricHistoryFixture({
          category: DataCategory.ERRORS,
          reserved: planDetails!.planCategories.errors![0]!.events,
          prepaid: planDetails!.planCategories.errors![0]!.events,
          order: 1,
        }),
      }),
      ...(hasPerformance && {
        transactions: MetricHistoryFixture({
          category: DataCategory.TRANSACTIONS,
          reserved: planDetails!.planCategories.transactions![0]!.events,
          prepaid: planDetails!.planCategories.transactions![0]!.events,
          order: 2,
        }),
      }),
      ...(hasReplays && {
        replays: MetricHistoryFixture({
          category: DataCategory.REPLAYS,
          reserved: planDetails!.planCategories.replays![0]!.events,
          prepaid: planDetails!.planCategories.replays![0]!.events,
          order: 4,
        }),
      }),
      ...(hasSpans && {
        spans: MetricHistoryFixture({
          category: DataCategory.SPANS,
          reserved: planDetails!.planCategories.spans![0]!.events,
          prepaid: planDetails!.planCategories.spans![0]!.events,
          order: 5,
        }),
        spansIndexed: MetricHistoryFixture({
          category: DataCategory.SPANS_INDEXED,
          reserved: planDetails!.planCategories.spans![0]!.events,
          prepaid: planDetails!.planCategories.spans![0]!.events,
          order: 6,
        }),
      }),
      ...(hasMonitors && {
        monitorSeats: MetricHistoryFixture({
          category: DataCategory.MONITOR_SEATS,
          reserved: planDetails!.planCategories.monitorSeats![0]!.events,
          prepaid: planDetails!.planCategories.monitorSeats![0]!.events,
          order: 7,
        }),
      }),
      ...(hasAttachments && {
        attachments: MetricHistoryFixture({
          category: DataCategory.ATTACHMENTS,
          reserved: planDetails!.planCategories.attachments![0]!.events,
          prepaid: planDetails!.planCategories.attachments![0]!.events,
          order: 8,
        }),
      }),
    },
    ...planData,
  };
}

export function Am3DsEnterpriseSubscriptionFixture(props: Props): TSubscription {
  const {organization: _organization, ...params} = props;
  const planData = {plan: 'am3_business_ent_ds_auf', ...params};

  const subscription = SubscriptionFixture({
    ...props,
    plan: planData.plan,
    planTier: planData.planTier,
    canSelfServe: false,
  });
  subscription.hasReservedBudgets = true;
  subscription.reservedBudgetCategories = [
    DataCategory.SPANS,
    DataCategory.SPANS_INDEXED,
  ];
  subscription.reservedBudgets = [
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
