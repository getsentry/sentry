import * as Sentry from '@sentry/react';
import moment from 'moment-timezone';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {fetchOrganizationDetails} from 'sentry/actionCreators/organization';
import {Client} from 'sentry/api';
import {t} from 'sentry/locale';
import {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {browserHistory} from 'sentry/utils/browserHistory';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';

import {DEFAULT_TIER, MONTHLY, SUPPORTED_TIERS} from 'getsentry/constants';
import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import type {
  DataCategories,
  EventBucket,
  OnDemandBudgets,
  Plan,
  PlanTier,
  PreviewData,
  Subscription,
} from 'getsentry/types';
import {getSlot} from 'getsentry/utils/billing';
import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';
import trackMarketingEvent from 'getsentry/utils/trackMarketingEvent';
import type {CheckoutAPIData, CheckoutFormData} from 'getsentry/views/amCheckout/types';
import {
  normalizeOnDemandBudget,
  parseOnDemandBudgetsFromSubscription,
  trackOnDemandBudgetAnalytics,
} from 'getsentry/views/onDemandBudgets/utils';
import {bigNumFormatter} from 'getsentry/views/spendAllocations/utils';

const CURRENCY_LOCALE = 'en-US';

/**
 * Includes $, and cents in the price when needed.
 *
 * 100.01 => $100.01
 * 100.00 => $100
 * 100.30 => $100.30
 * -100 => -$100
 */
type DisplayPriceTypes = {
  cents: number;
  formatBigNum?: boolean;
};

// Intent details returned by CustomerSubscriptionEndpoint
// when there is an error and customer card actions are
// required.
export type IntentDetails = {
  paymentIntent: string;
  paymentSecret: string;
};

type APIDataProps = {
  formData: CheckoutFormData;
  isPreview?: boolean;
  onDemandBudget?: OnDemandBudgets;
  paymentIntent?: string;
  previewToken?: PreviewData['previewToken'];
  referrer?: string;
  shouldUpdateOnDemand?: boolean;
};

export function displayPrice({cents, formatBigNum = false}: DisplayPriceTypes): string {
  const dollars = cents / 100;
  const prefix = dollars >= 0 ? '$' : '-$';

  if (formatBigNum) {
    return prefix + bigNumFormatter(Math.abs(dollars));
  }
  const hasCents = dollars % 1 !== 0;
  if (hasCents) {
    return displayPriceWithCents({cents});
  }
  return prefix + Math.abs(dollars).toLocaleString(CURRENCY_LOCALE);
}

/**
 * Always include $ and cents in the price.
 *
 * $100.01 => $100.01
 * $100.00 => $100.00
 * $100.30 => $100.30
 * -100 => -$100.00
 */
export function displayPriceWithCents({
  cents,
  minimumFractionDigits,
  maximumFractionDigits,
}: {
  cents: number;
  maximumFractionDigits?: number;
  minimumFractionDigits?: number;
}): string {
  const dollars = cents / 100;
  const prefix = dollars >= 0 ? '$' : '-$';

  return (
    prefix +
    Math.abs(dollars).toLocaleString(CURRENCY_LOCALE, {
      minimumFractionDigits: minimumFractionDigits ?? 2,
      maximumFractionDigits: maximumFractionDigits ?? 2,
    })
  );
}

type UnitPriceProps = {
  cents: number;
  maxDigits?: number;
  minDigits?: number;
};

/**
 * Includes cents in the price when needed and excludes $ for separate formatting.
 * Note: Use `displayPrice` if prices can be negative (ex: credits)
 *
 * 100.01 => 100.01
 * 100.00 => 100
 * 100.30 => 100.30
 * -100 => -100
 */
export function formatPrice({cents}: {cents: number}): string {
  return displayPrice({cents}).replace('$', '');
}

/**
 * Format per unit price for events,
 * where errors and transactions default to 5 digits
 * and attachments should use 2 digits.
 */
export function displayUnitPrice({
  cents,
  minDigits = 5,
  maxDigits = 7,
}: UnitPriceProps): string {
  const dollars = cents / 100;

  return (
    '$' +
    dollars.toLocaleString(CURRENCY_LOCALE, {
      minimumFractionDigits: minDigits,
      maximumFractionDigits: maxDigits,
    })
  );
}

export function getBucket({
  buckets,
  events,
  price,
  shouldMinimize = false,
}: {
  buckets?: EventBucket[];
  events?: number;
  price?: number;
  shouldMinimize?: boolean; // the slot strategy when `events` does not exist in `buckets`
}): EventBucket {
  if (buckets) {
    const slot = getSlot(events, price, buckets, shouldMinimize);
    if (slot in buckets) {
      return buckets[slot]!;
    }
  }
  throw new Error('Invalid data category for plan');
}

type ReservedTotalProps = {
  plan: Plan;
  reserved: {
    [categoryKey in DataCategory]?: number;
  };
  amount?: number;
  creditCategory?: string;
  discountType?: string;
  maxDiscount?: number;
};

/**
 * Returns the total plan price (including prices for reserved categories) in cents.
 */
export function getReservedPriceCents({
  plan,
  reserved,
  amount,
  discountType,
  maxDiscount,
  creditCategory,
}: ReservedTotalProps): number {
  let reservedCents = plan.basePrice;

  if (amount && discountType && creditCategory) {
    reservedCents = getDiscountedPrice({
      basePrice: reservedCents,
      amount,
      discountType,
      creditCategory,
    });
  }

  Object.entries(reserved).forEach(
    ([category, quantity]) =>
      (reservedCents += getBucket({
        events: quantity,
        buckets: plan.planCategories[category as DataCategories],
      }).price)
  );

  if (amount && maxDiscount) {
    const discount = Math.min(maxDiscount, (reservedCents * amount) / 10000);
    reservedCents -= discount;
  }

  return reservedCents;
}

/**
 * Gets the price in cents per reserved category, and returns the
 * reserved total in dollars.
 */
export function getReservedTotal({
  plan,
  reserved,
  amount,
  discountType,
  maxDiscount,
  creditCategory,
}: ReservedTotalProps): string {
  return formatPrice({
    cents: getReservedPriceCents({
      plan,
      reserved,
      amount,
      discountType,
      maxDiscount,
      creditCategory,
    }),
  });
}

type DiscountedPriceProps = {
  amount: number;
  basePrice: number;
  creditCategory: string;
  discountType: string;
};

/**
 * Gets the price in cents after the discount is applied.
 */
export function getDiscountedPrice({
  basePrice,
  discountType,
  amount,
  creditCategory,
}: DiscountedPriceProps): number {
  let price = basePrice;
  if (discountType === 'percentPoints' && creditCategory === 'subscription') {
    const discount = (basePrice * amount) / 10000;
    price = basePrice - discount;
  } else if (discountType === 'amountCents') {
    price = basePrice - amount;
  }
  return price;
}

/**
 * Returns the short billing interval name.
 */
export function getShortInterval(billingInterval: string): string {
  return billingInterval === MONTHLY ? 'mo' : 'yr';
}

function getAttachmentsWithUnit(gigabytes: number): string {
  return `${gigabytes.toLocaleString()} GB`;
}

/**
 * Used by RangeSlider. As such, a value of zero is not equivalent to unlimited.
 */
export function getEventsWithUnit(
  events: number,
  dataType: string
): string | number | null {
  if (!events) {
    return null;
  }

  if (dataType === DataCategory.ATTACHMENTS) {
    return getAttachmentsWithUnit(events).replace(' ', '');
  }

  if (events >= 1_000_000_000) {
    return `${events / 1_000_000_000}B`;
  }
  if (events >= 1_000_000) {
    return `${events / 1_000_000}M`;
  }
  if (events >= 1_000) {
    return `${events / 1_000}K`;
  }

  return events;
}

function recordAnalytics(
  organization: Organization,
  subscription: Subscription,
  data: CheckoutAPIData,
  isMigratingPartnerAccount: boolean
) {
  trackMarketingEvent('Upgrade', {plan: data.plan});

  const currentData = {
    plan: data.plan,
    errors: data.reservedErrors,
    transactions: data.reservedTransactions,
    attachments: data.reservedAttachments,
    replays: data.reservedReplays,
    monitorSeats: data.reservedMonitorSeats,
    spans: data.reservedSpans,
    profileDuration: data.reservedProfileDuration,
  };

  const previousData = {
    plan: subscription.plan,
    errors: subscription.categories.errors?.reserved || undefined,
    transactions: subscription.categories.transactions?.reserved || undefined,
    attachments: subscription.categories.attachments?.reserved || undefined,
    replays: subscription.categories.replays?.reserved || undefined,
    monitorSeats: subscription.categories.monitorSeats?.reserved || undefined,
    profileDuration: subscription.categories.profileDuration?.reserved || undefined,
    spans: subscription.categories.spans?.reserved || undefined,
  };

  trackGetsentryAnalytics('checkout.upgrade', {
    organization,
    subscription,
    previous_plan: previousData.plan,
    previous_errors: previousData.errors,
    previous_transactions: previousData.transactions,
    previous_attachments: previousData.attachments,
    previous_replays: previousData.replays,
    previous_monitorSeats: previousData.monitorSeats,
    previous_profileDuration: previousData.profileDuration,
    previous_spans: previousData.spans,
    ...currentData,
  });

  let {onDemandBudget} = data;
  if (onDemandBudget) {
    onDemandBudget = normalizeOnDemandBudget(onDemandBudget);
    const previousOnDemandBudget = parseOnDemandBudgetsFromSubscription(subscription);

    trackOnDemandBudgetAnalytics(
      organization,
      previousOnDemandBudget,
      onDemandBudget,
      'checkout'
    );
  }

  if (
    currentData.transactions &&
    previousData.transactions &&
    currentData.transactions > previousData.transactions
  ) {
    trackGetsentryAnalytics('checkout.transactions_upgrade', {
      organization,
      subscription,
      plan: data.plan,
      previous_transactions: previousData.transactions,
      transactions: currentData.transactions,
    });
  }

  if (isMigratingPartnerAccount) {
    trackGetsentryAnalytics('partner_billing_migration.checkout.completed', {
      subscription,
      organization,
      applyNow: data.applyNow ?? false,
      daysLeft: moment(subscription.contractPeriodEnd).diff(moment(), 'days'),
      partner: subscription.partner?.partnership.id,
    });
  }
}

export function stripeHandleCardAction(
  intentDetails: IntentDetails,
  stripeInstance?: stripe.Stripe,
  onSuccess?: () => void,
  onError?: (errorMessage?: string) => void
) {
  if (!stripeInstance) {
    return;
  }
  // Use stripe client library to handle additional actions.
  // This allows us to complete 3DS and MFA during checkout.
  stripeInstance
    .handleCardAction(intentDetails.paymentSecret)
    .then((result: stripe.PaymentIntentResponse) => {
      if (result.error) {
        let message =
          'Your payment could not be authorized. Please try a different card, or try again later.';
        if (
          ['card_error', 'validation_error'].includes(result.error.type) &&
          result.error.message
        ) {
          message = result.error.message;
        }
        onError?.(message);
        return;
      }
      // With our intent confirmed we can complete checkout.
      onSuccess?.();
    });
}

/** @internal exported for tests only */
export function getCheckoutAPIData({
  formData,
  onDemandBudget,
  previewToken,
  paymentIntent,
  referrer,
  shouldUpdateOnDemand = true,
}: APIDataProps) {
  const formatReservedData = (value: number | null | undefined) => value ?? undefined;

  const reservedData = {
    reservedErrors: formatReservedData(formData.reserved.errors),
    reservedTransactions: formatReservedData(formData.reserved.transactions),
    reservedAttachments: formatReservedData(formData.reserved.attachments),
    reservedReplays: formatReservedData(formData.reserved.replays),
    reservedMonitorSeats: formatReservedData(formData.reserved.monitorSeats),
    reservedProfileDuration: formatReservedData(formData.reserved.profileDuration),
    reservedSpans: formatReservedData(formData.reserved.spans),
  } satisfies Partial<
    // Enforce plural spelling against the enums in DataCategory
    Record<`reserved${Capitalize<DataCategory>}`, number | undefined>
  >;

  const onDemandMaxSpend = shouldUpdateOnDemand
    ? formData.onDemandMaxSpend ?? 0
    : undefined;

  let data: CheckoutAPIData = {
    ...reservedData,
    onDemandBudget,
    plan: formData.plan,
    onDemandMaxSpend,
    referrer: referrer || 'billing',
    ...(previewToken && {previewToken}),
    ...(paymentIntent && {paymentIntent}),
  };

  if (formData.applyNow) {
    data = {
      ...data,
      applyNow: true,
    };
  }
  return data;
}

export async function fetchPreviewData(
  organization: Organization,
  api: Client,
  formData: CheckoutFormData,
  onLoading: () => void,
  onSuccess: (previewData: PreviewData) => void,
  onError: (error: any) => void
) {
  onLoading?.();
  const data = getCheckoutAPIData({formData, isPreview: true});
  try {
    const previewData: PreviewData = await api.requestPromise(
      `/customers/${organization.slug}/subscription/preview/`,
      {
        method: 'GET',
        data,
      }
    );
    onSuccess?.(previewData);
  } catch (error) {
    onError?.(error);

    Sentry.withScope(scope => {
      scope.setExtras({data});
      Sentry.captureException(error);
    });
  }
}

export async function submitCheckout(
  organization: Organization,
  subscription: Subscription,
  previewData: PreviewData,
  formData: CheckoutFormData,
  api: Client,
  onFetchPreviewData: () => void,
  onHandleCardAction: (intentDetails: IntentDetails) => void,
  onSubmitting?: (b: boolean) => void,
  intentId?: string,
  referrer = 'billing',
  codecovReferrer = 'checkout',
  shouldUpdateOnDemand = true
) {
  const endpoint = `/customers/${organization.slug}/subscription/`;

  let {onDemandBudget} = formData;
  if (onDemandBudget) {
    onDemandBudget = normalizeOnDemandBudget(onDemandBudget);
  }

  // this is necessary for recording partner billing migration-specific analytics after
  // the migration is successful (during which the flag is flipped off)
  const isMigratingPartnerAccount = organization.features.includes(
    'partner-billing-migration'
  );

  const data = getCheckoutAPIData({
    formData,
    onDemandBudget,
    previewToken: previewData?.previewToken,
    paymentIntent: intentId,
    referrer,
    shouldUpdateOnDemand,
  });

  addLoadingMessage(t('Saving changes\u{2026}'));
  try {
    onSubmitting?.(true);

    await api.requestPromise(endpoint, {
      method: 'PUT',
      data,
    });

    addSuccessMessage(t('Success'));
    recordAnalytics(organization, subscription, data, isMigratingPartnerAccount);

    // refresh org and subscription state
    // useApi cancels open requests on unmount by default, so we create a new Client to ensure this
    // request doesn't get cancelled
    fetchOrganizationDetails(new Client(), organization.slug);
    SubscriptionStore.loadData(organization.slug);
    browserHistory.push(
      normalizeUrl(
        `/settings/${organization.slug}/billing/overview/?open_codecov_modal=1&referrer=${codecovReferrer}`
      )
    );
  } catch (error) {
    const body = error.responseJSON;

    if (body?.previewToken) {
      onSubmitting?.(false);
      addErrorMessage(t('Your preview expired, please review changes and submit again'));
      onFetchPreviewData?.();
    } else if (body?.paymentIntent && body?.paymentSecret && body?.detail) {
      // When an error response contains payment intent information
      // we can retry the payment using the client-side confirmation flow
      // in stripe.
      // We don't re-enable the button here as we don't want users clicking it
      // while there are UI transitions happening.
      addErrorMessage(body.detail);
      const intent: IntentDetails = {
        paymentIntent: body.paymentIntent,
        paymentSecret: body.paymentSecret,
      };
      onHandleCardAction?.(intent);
    } else {
      const msg =
        body?.detail || t('An unknown error occurred while saving your subscription');
      addErrorMessage(msg);
      onSubmitting?.(false);

      // Don't capture 402 errors as that status code is used for
      // customer credit card failures.
      if (error.status !== 402) {
        Sentry.withScope(scope => {
          scope.setExtras({data});
          Sentry.captureException(error);
        });
      }
    }
  }
}

export function getToggleTier(checkoutTier: PlanTier | undefined) {
  // cannot toggle from or to AM3
  if (checkoutTier === DEFAULT_TIER || !checkoutTier || SUPPORTED_TIERS.length === 0) {
    return null;
  }

  if (SUPPORTED_TIERS.length === 1) {
    return SUPPORTED_TIERS[0];
  }

  const tierIndex = SUPPORTED_TIERS.indexOf(checkoutTier);

  // can toggle between AM1 and AM2 for AM1 customers
  if (tierIndex === SUPPORTED_TIERS.length - 1) {
    return SUPPORTED_TIERS[tierIndex - 1];
  }

  return SUPPORTED_TIERS[tierIndex + 1];
}
