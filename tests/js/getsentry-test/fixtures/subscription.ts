import {MetricHistoryFixture} from 'getsentry-test/fixtures/metricHistory';
import {
  PlanDetailsLookupFixture,
  type PlanIds,
} from 'getsentry-test/fixtures/planDetailsLookup';
import {SeerReservedBudgetFixture} from 'getsentry-test/fixtures/reservedBudget';

import {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';

import {RESERVED_BUDGET_QUOTA} from 'getsentry/constants';
import type {Plan, Subscription as TSubscription} from 'getsentry/types';
import {AddOnCategory, BillingType} from 'getsentry/types';

const TRIAL_PLANS = ['am1_t', 'am2_t', 'am3_t', 'am1_t_ent', 'am2_t_ent', 'am3_t_ent'];

// Derives whether a plan id is a trial plan, so the fixture can set the
// trial-related fields the backend resolves from the subscription.
const isTrialPlan = (plan: string) => TRIAL_PLANS.includes(plan);

type Props = Partial<TSubscription> & {organization: Organization};

export function SubscriptionFixture(props: Props): TSubscription {
  const {organization, ...params} = props;
  const planData = {plan: 'am1_f', ...params};

  // Use planDetails from params if provided, otherwise look it up
  const planDetails = (planData.planDetails ||
    PlanDetailsLookupFixture(planData.plan as PlanIds)) as Plan;

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
  const hasSizeAnalyses = planDetails?.categories?.includes(DataCategory.SIZE_ANALYSIS);
  const hasInstallableBuilds = planDetails?.categories?.includes(
    DataCategory.INSTALLABLE_BUILD
  );
  const hasLegacySeer = AddOnCategory.LEGACY_SEER in planDetails.addOnCategories;
  const hasSeer = AddOnCategory.SEER in planDetails.addOnCategories;

  // Create a safe default for planCategories if it doesn't exist
  const safeCategories = planDetails?.planCategories || {};

  const isTrial = isTrialPlan(planDetails.id);
  const isEnterpriseTrial = isTrial && planDetails.isEnterprise;
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
    hasDismissedTrialEndingNotice: false,
    hasMigratedToBillingPlatform: false,
    hadCustomDynamicSampling: false,
    id: '',
    isEnterpriseTrial,
    isOverMemberLimit: false,
    isPartner: false,
    isSelfServePartner: false,
    lastTrialEnd: null,
    spendAllocationEnabled: false,
    status: 'active',
    totalProjects: 0,
    trialPlan: isTrial ? planDetails.id : null,
    onDemandPeriodStart: '2018-09-25',
    trialEnd: null,
    countryCode: null,
    cancelAtPeriodEnd: false,
    onTrialPlan: isTrial,
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
    totalLicenses: 1,
    billingPeriodStart: '2018-09-25',
    suspensionReason: null,
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
    isPastDue: false,
    onDemandDisabled: false,
    onDemandInvoiced: false,
    onDemandMaxSpend: 0,
    productTrials: [],
    isManaged: false,
    canTrial: true,
    slug: organization.slug,
    pendingChanges: null,
    name: organization.name,
    billingInterval: planDetails.billingInterval || 'monthly',
    dateJoined: '2018-09-10T23:58:10.167Z',
    onDemandPeriodEnd: '2018-10-24',
    msaUpdatedForDataConsent: false,
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
      ...(hasSizeAnalyses && {
        sizeAnalyses: MetricHistoryFixture({
          category: DataCategory.SIZE_ANALYSIS,
          reserved: safeCategories.sizeAnalyses?.[0]?.events || 100,
          prepaid: safeCategories.sizeAnalyses?.[0]?.events || 100,
          order: 17,
        }),
      }),
      ...(hasInstallableBuilds && {
        installableBuilds: MetricHistoryFixture({
          category: DataCategory.INSTALLABLE_BUILD,
          reserved: safeCategories.installableBuilds?.[0]?.events || 0,
          prepaid: safeCategories.installableBuilds?.[0]?.events || 0,
          order: 18,
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
  const planData = {plan: 'am2_business_ent_auf', ...props};
  const planDetails = PlanDetailsLookupFixture(planData.plan as PlanIds);
  const subscription = SubscriptionFixture({
    ...props,
    planDetails,
    plan: planDetails?.id,
    canSelfServe: false,
    type: BillingType.INVOICED,
    channel: 'sales',
    accountBalance: 0,
    isFree: false,
  });

  return subscription;
}
