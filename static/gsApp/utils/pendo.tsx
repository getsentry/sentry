import pick from 'lodash/pick';

import {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import getDaysSinceDate from 'sentry/utils/getDaysSinceDate';
import getOrganizationAge from 'sentry/utils/getOrganizationAge';

import type {PromotionClaimed, Subscription} from 'getsentry/types';

import {getProductTrial, getTrialDaysLeft} from './billing';

// we encode sizes for bucketing using roygbiv coloring
const SIZES = {
  NONE: 'red',
  XXSMALL: 'orange',
  XSMALL: 'yellow',
  SMALL: 'green',
  MEDIUM: 'blue',
  LARGE: 'indigo',
  XLARGE: 'violet',
  XXLARGE: 'teal',
  XXXLARGE: 'magenta',
} as const;

// a map of custom fields that rely on bucketing
const CUSTOM_BUCKET_FIELDS = {
  arr: getReservedTotalFromSubscription,
  accountCredit: getAccountCredit,
};
type CustomFields = keyof typeof CUSTOM_BUCKET_FIELDS;
type Size = (typeof SIZES)[keyof typeof SIZES];
type BucketRecord = Array<[number, Size]>;
type BucketMap = Partial<Record<keyof Subscription | CustomFields, BucketRecord>>;

// the values in the bucket are the max values for each bucket inclusive
// soo arr = 1,000 is small and 1,001 is medium
const BUCKET_MAP: BucketMap = {
  totalMembers: [
    [1, SIZES.XXSMALL],
    [5, SIZES.XSMALL],
    [25, SIZES.SMALL],
    [100, SIZES.MEDIUM],
    [250, SIZES.LARGE],
    [500, SIZES.XLARGE],
    [1000, SIZES.XXLARGE],
  ],
  reservedErrors: [
    [5_000, SIZES.XXSMALL],
    [50_000, SIZES.XSMALL],
    [200_000, SIZES.SMALL],
    [1_000_000, SIZES.MEDIUM],
    [5_000_000, SIZES.LARGE],
    [10_000_000, SIZES.XLARGE],
    [15_000_000, SIZES.XXLARGE],
  ],
  reservedTransactions: [
    [10_000, SIZES.XXSMALL],
    [100_000, SIZES.XSMALL],
    [400_000, SIZES.SMALL],
    [2_000_000, SIZES.MEDIUM],
    [10_000_000, SIZES.LARGE],
    [20_000_000, SIZES.XLARGE],
    [50_000_000, SIZES.XXLARGE],
  ],
  arr: [
    [500, SIZES.XXSMALL],
    [1_000, SIZES.XSMALL],
    [5_000, SIZES.SMALL],
    [20_000, SIZES.MEDIUM],
    [50_000, SIZES.LARGE],
    [100_000_000, SIZES.XLARGE],
    [200_000_000, SIZES.XXLARGE],
  ],
  // $0 is red, <$5 is orange, $5-$29 is yellow, $29-$89 is green, $89-$348 is blue, $348-$1068 is indigo, $1068+ is violet
  accountCredit: [
    [4.99, SIZES.XXSMALL],
    [28.99, SIZES.XSMALL], // $29 (1 month team plan)
    [88.99, SIZES.SMALL], // $89 (1 month business plan)
    [347.99, SIZES.MEDIUM], // $348 (1 year team plan)
    [1067.99, SIZES.LARGE], // $1068 (1 year business plan)
    [2_000, SIZES.XLARGE],
    [4_000, SIZES.XXLARGE],
  ],
};

export function getPendoAccountFields(
  subscription: Subscription,
  organization: Organization,
  {
    activePromotions,
    completedPromotions,
  }: {
    activePromotions: PromotionClaimed[] | null;
    completedPromotions: PromotionClaimed[] | null;
  }
) {
  // add basic fields as-is
  const baseAccountFields = {
    ...pick(subscription, [
      'isFree',
      'isManaged',
      'isTrial',
      'isEnterpriseTrial',
      'isPerformancePlanTrial',
      'isSuspended',
      'canTrial',
      'canSelfServe',
      'plan',
      'planTier',
    ]),
    ...pick(organization, ['isEarlyAdopter']),
  };
  // for fields with bucketing, we need to encode the value so
  // we can obfuscate this information
  for (const field in BUCKET_MAP) {
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    const buckets = BUCKET_MAP[field];
    let value: number | undefined;
    if (field in subscription) {
      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      value = subscription[field];
    } else if (field in CUSTOM_BUCKET_FIELDS) {
      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      value = CUSTOM_BUCKET_FIELDS[field](subscription);
    }
    if (value !== undefined) {
      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      baseAccountFields[field] = getBucketValue(value, buckets);
    }
  }

  const promoInfo: {
    activePromotion: null | string;
    completedPromotions: string;
    daysSincePromotionClaimed: number;
    freeEventCreditDaysLeft: number;
    isLastCycleForFreeEvents: boolean;
    promotionDaysLeft: number;
  } = {
    activePromotion: null,
    promotionDaysLeft: -1,
    completedPromotions: (completedPromotions || []).map(p => p.promotion.slug).join(','),
    freeEventCreditDaysLeft: -1,
    isLastCycleForFreeEvents: false,
    daysSincePromotionClaimed: -1,
  };
  if (activePromotions && activePromotions.length > 0) {
    const promo = activePromotions[0]!;
    promoInfo.activePromotion = promo.promotion.slug;
    promoInfo.daysSincePromotionClaimed = getDaysSinceDate(promo.dateClaimed);
    if (promo.promotion.endDate) {
      promoInfo.promotionDaysLeft = -1 * getDaysSinceDate(promo.promotion.endDate);
    }
  }

  if (completedPromotions && completedPromotions.length > 0) {
    const promo = completedPromotions[0]!;
    promoInfo.freeEventCreditDaysLeft = promo.freeEventCreditDaysLeft;
    promoInfo.isLastCycleForFreeEvents = promo.isLastCycleForFreeEvents;
    promoInfo.daysSincePromotionClaimed = getDaysSinceDate(promo.dateClaimed);
  }

  const perfTrial = getProductTrial(
    subscription.productTrials ?? null,
    DataCategory.TRANSACTIONS
  );
  const perfTrialAvailable: boolean = perfTrial ? !perfTrial.isStarted : false;
  const perfTrialStartDate: string = perfTrial?.startDate ?? '';
  const perfTrialEndDate: string = perfTrial?.endDate ?? '';
  const perfTrialActive: boolean = perfTrial
    ? perfTrial.isStarted && getDaysSinceDate(perfTrial.endDate ?? '') <= 0
    : false;

  const replayTrial = getProductTrial(
    subscription.productTrials ?? null,
    DataCategory.REPLAYS
  );
  const replayTrialAvailable: boolean = replayTrial ? !replayTrial.isStarted : false;
  const replayTrialStartDate: string = replayTrial?.startDate ?? '';
  const replayTrialEndDate: string = replayTrial?.endDate ?? '';
  const replayTrialActive: boolean = replayTrial
    ? replayTrial.isStarted && getDaysSinceDate(replayTrial.endDate ?? '') <= 0
    : false;

  const profilesTrial = getProductTrial(
    subscription.productTrials ?? null,
    DataCategory.PROFILE_DURATION
  );
  const profilesTrialAvailable: boolean = profilesTrial
    ? !profilesTrial.isStarted
    : false;
  const profilesTrialStartDate: string = profilesTrial?.startDate ?? '';
  const profilesTrialEndDate: string = profilesTrial?.endDate ?? '';
  const profilesTrialActive: boolean = profilesTrial
    ? profilesTrial.isStarted && getDaysSinceDate(profilesTrial.endDate ?? '') <= 0
    : false;

  const spansTrial = getProductTrial(
    subscription.productTrials ?? null,
    DataCategory.SPANS
  );
  const spansTrialAvailable: boolean = spansTrial ? !spansTrial.isStarted : false;
  const spansTrialStartDate: string = spansTrial?.startDate ?? '';
  const spansTrialEndDate: string = spansTrial?.endDate ?? '';
  const spansTrialActive: boolean = spansTrial
    ? spansTrial.isStarted && getDaysSinceDate(spansTrial.endDate ?? '') <= 0
    : false;

  return {
    ...baseAccountFields,
    trialDaysLeft: getTrialDaysLeftFromSub(subscription),
    organizationAge: getOrganizationAge(organization),
    // don't want to send in actual on-demand spend
    // so just send in a boolean flag if it's enabled
    // may want to convert to a bucketed field eventually
    hasOnDemandSpend: subscription.onDemandMaxSpend > 0,
    considerForDsUpsell: getConsiderForDsUpsell(subscription),
    perfTrialAvailable,
    perfTrialStartDate,
    perfTrialEndDate,
    perfTrialActive,
    replayTrialAvailable,
    replayTrialStartDate,
    replayTrialEndDate,
    replayTrialActive,
    profilesTrialAvailable,
    profilesTrialStartDate,
    profilesTrialEndDate,
    profilesTrialActive,
    spansTrialAvailable,
    spansTrialStartDate,
    spansTrialEndDate,
    spansTrialActive,
    ...promoInfo,
  };
}

function getBucketValue(value: number, buckets: BucketRecord): Size {
  // if 0, use special case
  if (value === 0) {
    return SIZES.NONE;
  }
  for (const bucket of buckets) {
    // if our value is less than or equal to the bucket, use it
    if (value <= bucket[0]) {
      return bucket[1];
    }
  }
  // if no match, use xxxlarge
  return SIZES.XXXLARGE;
}

/**
 * Get the value in dollars of the current subscription as the input and divide by 100
 */
function getReservedTotalFromSubscription(subscription: Subscription) {
  const {planDetails} = subscription;
  const monthlyPrice =
    planDetails.billingInterval === 'annual'
      ? planDetails.totalPrice / 12
      : planDetails.totalPrice;
  return monthlyPrice / 100.0;
}

function getAccountCredit(subscription: Subscription) {
  // invert to get credit and divide by 100 to get $ amount
  return subscription.accountBalance / -100.0;
}

function getTrialDaysLeftFromSub(subscription: Subscription) {
  // only check if trial is active
  if (!subscription.isTrial) {
    return null;
  }
  return getTrialDaysLeft(subscription);
}

// consider the org if they have at least 5m reserved transactions
function getConsiderForDsUpsell(subscription: Subscription) {
  return (subscription.reservedTransactions || 0) >= 5_000_000;
}
