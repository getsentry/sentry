import {MetricHistoryFixture} from 'getsentry-test/fixtures/metricHistory';
import {PlanDetailsLookupFixture} from 'getsentry-test/fixtures/planDetailsLookup';

import {DATA_CATEGORY_INFO} from 'sentry/constants';
import {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';

import type {Subscription as TSubscription} from 'getsentry/types';
import {BillingType} from 'getsentry/types';
import {RESERVED_BUDGET_QUOTA} from 'getsentry/constants';
import {ReservedBudgetFixture} from 'getsentry-test/fixtures/reservedBudget';
import {ReservedBudgetMetricHistoryFixture} from 'getsentry-test/fixtures/reservedBudget';

type Props = Partial<TSubscription> & {organization: Organization};

export function SubscriptionFixture(props: Props): TSubscription {
  const {organization, ...params} = props;
  const planData = {plan: 'am1_f', ...params};
  const planDetails = PlanDetailsLookupFixture(planData.plan);

  const hasPerformance = planDetails?.categories?.includes(
    DATA_CATEGORY_INFO.transaction.plural
  );
  const hasReplays = planDetails?.categories?.includes(DATA_CATEGORY_INFO.replay.plural);
  const hasMonitors = planDetails?.categories?.includes(
    DATA_CATEGORY_INFO.monitorSeat.plural
  );
  const hasUptime = planDetails?.categories?.includes(DATA_CATEGORY_INFO.uptime.plural);
  const hasSpans = planDetails?.categories?.includes(DATA_CATEGORY_INFO.span.plural);
  const hasSpansIndexed = planDetails?.categories?.includes(
    DATA_CATEGORY_INFO.spanIndexed.plural
  );
  const hasProfileDuration = planDetails?.categories?.includes(
    DataCategory.PROFILE_DURATION
  );
  const hasAttachments = planDetails?.categories?.includes(
    DATA_CATEGORY_INFO.attachment.plural
  );

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
    planDetails: planDetails!,
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
    reservedEvents: planDetails!.planCategories.errors![0]!.events,
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
        category: DATA_CATEGORY_INFO.error.plural,
        reserved: planDetails!.planCategories.errors![0]!.events,
        prepaid: planDetails!.planCategories.errors![0]!.events,
        order: 1,
      }),
      ...(hasPerformance && {
        transactions: MetricHistoryFixture({
          category: DATA_CATEGORY_INFO.transaction.plural,
          reserved: planDetails!.planCategories.transactions![0]!.events,
          prepaid: planDetails!.planCategories.transactions![0]!.events,
          order: 2,
        }),
      }),
      ...(hasReplays && {
        replays: MetricHistoryFixture({
          category: DATA_CATEGORY_INFO.replay.plural,
          reserved: planDetails!.planCategories.replays![0]!.events,
          prepaid: planDetails!.planCategories.replays![0]!.events,
          order: 4,
        }),
      }),
      ...(hasSpans && {
        spans: MetricHistoryFixture({
          category: DATA_CATEGORY_INFO.span.plural,
          reserved: planDetails!.planCategories.spans![0]!.events,
          prepaid: planDetails!.planCategories.spans![0]!.events,
          order: 5,
        }),
      }),
      ...(hasSpansIndexed && {
        spansIndexed: MetricHistoryFixture({
          category: DATA_CATEGORY_INFO.spanIndexed.plural,
          reserved: planDetails!.planCategories.spans![0]!.events,
          prepaid: planDetails!.planCategories.spans![0]!.events,
          order: 6,
        }),
      }),
      ...(hasMonitors && {
        monitorSeats: MetricHistoryFixture({
          category: DATA_CATEGORY_INFO.monitorSeat.plural,
          reserved: planDetails!.planCategories.monitorSeats![0]!.events,
          prepaid: planDetails!.planCategories.monitorSeats![0]!.events,
          order: 7,
        }),
      }),
      ...(hasUptime && {
        uptime: MetricHistoryFixture({
          category: DATA_CATEGORY_INFO.uptime.plural,
          reserved: planDetails!.planCategories.uptime![0]!.events,
          prepaid: planDetails!.planCategories.uptime![0]!.events,
          order: 8,
        }),
      }),
      ...(hasAttachments && {
        attachments: MetricHistoryFixture({
          category: DATA_CATEGORY_INFO.attachment.plural,
          reserved: planDetails!.planCategories.attachments![0]!.events,
          prepaid: planDetails!.planCategories.attachments![0]!.events,
          order: 9,
        }),
      }),
      ...(hasProfileDuration && {
        profileDuration: MetricHistoryFixture({
          category: DataCategory.PROFILE_DURATION,
          reserved: planDetails!.planCategories.profileDuration![0]!.events,
          prepaid: planDetails!.planCategories.profileDuration![0]!.events,
          order: 10,
        }),
      }),
    },
    ...planData,
  };
}

export function InvoicedSubscriptionFixture(props: Props): TSubscription {
  const {organization, ...params} = props;
  const planData = {plan: 'am2_business_ent_auf', ...params};
  const planDetails = PlanDetailsLookupFixture(planData.plan);

  const hasErrors = planDetails?.categories?.includes(DATA_CATEGORY_INFO.error.plural);
  const hasPerformance = planDetails?.categories?.includes(
    DATA_CATEGORY_INFO.transaction.plural
  );
  const hasReplays = planDetails?.categories?.includes(DATA_CATEGORY_INFO.replay.plural);
  const hasMonitors = planDetails?.categories?.includes(
    DATA_CATEGORY_INFO.monitorSeat.plural
  );
  const hasSpans = planDetails?.categories?.includes(DATA_CATEGORY_INFO.span.plural);
  const hasAttachments = planDetails?.categories?.includes(
    DATA_CATEGORY_INFO.attachment.plural
  );

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
          category: DATA_CATEGORY_INFO.error.plural,
          reserved: planDetails!.planCategories.errors![0]!.events,
          prepaid: planDetails!.planCategories.errors![0]!.events,
          order: 1,
        }),
      }),
      ...(hasPerformance && {
        transactions: MetricHistoryFixture({
          category: DATA_CATEGORY_INFO.transaction.plural,
          reserved: planDetails!.planCategories.transactions![0]!.events,
          prepaid: planDetails!.planCategories.transactions![0]!.events,
          order: 2,
        }),
      }),
      ...(hasReplays && {
        replays: MetricHistoryFixture({
          category: DATA_CATEGORY_INFO.replay.plural,
          reserved: planDetails!.planCategories.replays![0]!.events,
          prepaid: planDetails!.planCategories.replays![0]!.events,
          order: 4,
        }),
      }),
      ...(hasSpans && {
        spans: MetricHistoryFixture({
          category: DATA_CATEGORY_INFO.span.plural,
          reserved: planDetails!.planCategories.spans![0]!.events,
          prepaid: planDetails!.planCategories.spans![0]!.events,
          order: 5,
        }),
        spansIndexed: MetricHistoryFixture({
          category: DATA_CATEGORY_INFO.spanIndexed.plural,
          reserved: planDetails!.planCategories.spans![0]!.events,
          prepaid: planDetails!.planCategories.spans![0]!.events,
          order: 6,
        }),
      }),
      ...(hasMonitors && {
        monitorSeats: MetricHistoryFixture({
          category: DATA_CATEGORY_INFO.monitorSeat.plural,
          reserved: planDetails!.planCategories.monitorSeats![0]!.events,
          prepaid: planDetails!.planCategories.monitorSeats![0]!.events,
          order: 7,
        }),
      }),
      ...(hasAttachments && {
        attachments: MetricHistoryFixture({
          category: DATA_CATEGORY_INFO.attachment.plural,
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
  const {organization, ...params} = props;
  const planData = {plan: 'am3_business_ent_ds_auf', ...params};

  const subscription = SubscriptionFixture({
    ...props,
    plan: planData.plan,
    planTier: planData.planTier,
  });
  subscription.hasReservedBudgets = true;
  subscription.reservedBudgetCategories = ['spans', 'spansIndexed'];
  subscription.reservedBudgets = [
    ReservedBudgetFixture({
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
