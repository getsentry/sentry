import * as Sentry from '@sentry/react';
import type {PaymentIntentResult, Stripe} from '@stripe/stripe-js';
import camelCase from 'lodash/camelCase';
import moment from 'moment-timezone';

import {fetchOrganizationDetails} from 'sentry/actionCreators/organization';
import {Client} from 'sentry/api';
import {t} from 'sentry/locale';
import type {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {useMutation} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';
import useApi from 'sentry/utils/useApi';

import type {Reservations} from 'getsentry/components/upgradeNowModal/types';
import {MONTHLY, RESERVED_BUDGET_QUOTA} from 'getsentry/constants';
import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import {AddOnCategory, PlanTier, ReservedBudgetCategoryType} from 'getsentry/types';
import type {
  BillingDetails,
  CheckoutAddOns,
  EventBucket,
  InvoiceItemType,
  OnDemandBudgets,
  Plan,
  PreviewData,
  Subscription,
} from 'getsentry/types';
import {
  getAmPlanTier,
  getReservedBudgetCategoryForAddOn,
  getSlot,
  hasPartnerMigrationFeature,
  hasSomeBillingDetails,
  isBizPlanFamily,
  isTeamPlanFamily,
  isTrialPlan,
} from 'getsentry/utils/billing';
import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';
import trackMarketingEvent from 'getsentry/utils/trackMarketingEvent';
import type {State as CheckoutState} from 'getsentry/views/amCheckout/';
import type {
  CheckoutAPIData,
  CheckoutFormData,
  PlanContent,
} from 'getsentry/views/amCheckout/types';
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
  reserved: Partial<Record<DataCategory, number>>;
  addOns?: CheckoutAddOns;
  amount?: number;
  creditCategory?: InvoiceItemType;
  discountType?: string;
  maxDiscount?: number;
};

/**
 * Returns the price for a reserved budget category (ie. Seer) in cents.
 */
function getReservedPriceForReservedBudgetCategory({
  plan,
  reservedBudgetCategory,
}: {
  plan: Plan;
  reservedBudgetCategory: ReservedBudgetCategoryType;
}): number {
  const budgetTypeInfo = plan.availableReservedBudgetTypes[reservedBudgetCategory];
  if (!budgetTypeInfo) {
    return 0;
  }
  return budgetTypeInfo.dataCategories.reduce((acc, dataCategory) => {
    const bucket = getBucket({
      events: RESERVED_BUDGET_QUOTA,
      buckets: plan.planCategories[dataCategory],
    });
    return acc + bucket.price;
  }, 0);
}

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
  addOns,
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
        buckets: plan.planCategories[category as DataCategory],
      }).price)
  );

  Object.entries(addOns ?? {}).forEach(([apiName, {enabled}]) => {
    if (enabled) {
      reservedCents += getPrepaidPriceForAddOn({
        plan,
        addOnCategory: apiName as AddOnCategory,
      });
    }
  });

  if (amount && maxDiscount) {
    const discount = Math.min(maxDiscount, (reservedCents * amount) / 10000);
    reservedCents -= discount;
  }

  return reservedCents;
}

type DiscountedPriceProps = {
  amount: number;
  basePrice: number;
  creditCategory: InvoiceItemType | null;
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

type CheckoutData = {
  plan: string;
} & Partial<Record<DataCategory, number>>;

type PreviousData = {
  previous_plan: string;
} & Partial<Record<`previous_${DataCategory}`, number>>;

/**
 * Nested structure for category reservations in checkout.upgrade event.
 * This provides a cleaner structure for Amplitude analytics while maintaining
 * backwards compatibility with flat fields.
 */
type CategoryReservations = Partial<
  Record<
    DataCategory,
    {
      previous_reserved: number | undefined;
      reserved: number | undefined;
    }
  >
>;

function recordAnalytics(
  organization: Organization,
  subscription: Subscription,
  data: CheckoutAPIData,
  isMigratingPartnerAccount: boolean
) {
  trackMarketingEvent('Upgrade', {plan: data.plan});
  const currentData: CheckoutData = {
    plan: data.plan,
  };

  const productSelectAnalyticsData: Partial<
    Record<AddOnCategory, {enabled: boolean; previously_enabled: boolean}>
  > = {};

  const previousData: PreviousData = {
    previous_plan: subscription.plan,
  };

  // Build nested categories structure for better Amplitude analytics
  const categories: CategoryReservations = {};

  // Parse previous data and populate both flat and nested structures
  Object.entries(subscription.categories).forEach(([category, metricHistory]) => {
    if (
      subscription.planDetails.checkoutCategories.includes(category as DataCategory) &&
      metricHistory.reserved !== null &&
      metricHistory.reserved !== undefined
    ) {
      const cat = category as DataCategory;

      // Legacy flat structure (backwards compatibility)
      (previousData as any)[`previous_${category}`] = metricHistory.reserved;

      // New nested structure
      if (!categories[cat]) {
        categories[cat] = {reserved: undefined, previous_reserved: undefined};
      }
      categories[cat].previous_reserved = metricHistory.reserved;
    }
  });

  // Parse current data and populate both flat and nested structures
  Object.keys(data).forEach(key => {
    if (key.startsWith('reserved')) {
      const targetKey = (key.charAt(8).toLowerCase() + key.slice(9)) as DataCategory;
      const value = data[key as keyof CheckoutAPIData] as number | undefined;

      // Legacy flat structure (backwards compatibility)
      (currentData as any)[targetKey] = value;

      // New nested structure - only add if value is defined
      if (value !== undefined) {
        if (!categories[targetKey]) {
          categories[targetKey] = {reserved: undefined, previous_reserved: undefined};
        }
        categories[targetKey].reserved = value;
      }
    }
    if (key.startsWith('addOn')) {
      const targetKey = (key.charAt(5).toLowerCase() + key.slice(6)) as AddOnCategory;
      const previouslyEnabled = subscription.addOns?.[targetKey]?.enabled ?? false;
      productSelectAnalyticsData[targetKey] = {
        enabled: data[key as keyof CheckoutAPIData] as boolean,
        // don't count trial addons
        previously_enabled: !isTrialPlan(previousData.previous_plan) && previouslyEnabled,
      };
    }
  });

  // Filter out categories where both values are undefined
  const filteredCategories: CategoryReservations = {};
  Object.entries(categories).forEach(([category, values]) => {
    if (values.reserved !== undefined || values.previous_reserved !== undefined) {
      filteredCategories[category as DataCategory] = values;
    }
  });

  trackGetsentryAnalytics('checkout.upgrade', {
    organization,
    subscription,
    ...previousData,
    ...currentData,
    categories: filteredCategories, // Add new nested structure
  });

  trackGetsentryAnalytics('checkout.product_select', {
    organization,
    subscription,
    ...productSelectAnalyticsData,
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

  // TODO: remove this analytic event; this can be inferred from the `checkout.upgrade` event
  if (
    currentData.transactions &&
    previousData.previous_transactions &&
    currentData.transactions > previousData.previous_transactions
  ) {
    trackGetsentryAnalytics('checkout.transactions_upgrade', {
      organization,
      subscription,
      plan: data.plan,
      previous_transactions: previousData.previous_transactions,
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
  stripeInstance: Stripe | null,
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
    .then((result: PaymentIntentResult) => {
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

export function getCheckoutAPIData({
  formData,
  onDemandBudget,
  previewToken,
  paymentIntent,
  referrer,
  shouldUpdateOnDemand = true,
}: APIDataProps) {
  const formatReservedData = (value: number | null | undefined) => value ?? undefined;

  const reservedData = Object.fromEntries(
    Object.entries(formData.reserved).map(([category, value]) => [
      `reserved${toTitleCase(category, {
        allowInnerUpperCase: true,
      })}`,
      formatReservedData(value),
    ])
  ) satisfies Partial<Reservations>;

  const onDemandMaxSpend = shouldUpdateOnDemand
    ? (formData.onDemandMaxSpend ?? 0)
    : undefined;

  const addOnData = Object.fromEntries(
    Object.entries(formData.addOns ?? {}).map(([addOnName, {enabled}]) => [
      `addOn${toTitleCase(addOnName, {
        allowInnerUpperCase: true,
      })}`,
      enabled,
    ])
  ) satisfies Partial<Record<`addOn${Capitalize<AddOnCategory>}`, boolean>>;

  let data: CheckoutAPIData = {
    ...reservedData,
    onDemandBudget,
    plan: formData.plan,
    onDemandMaxSpend,
    referrer: referrer || 'billing',
    ...(previewToken && {previewToken}),
    ...(paymentIntent && {paymentIntent}),
    ...addOnData,
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

export function normalizeAndGetCheckoutAPIData({
  formData,
  previewToken,
  paymentIntent,
  referrer = 'billing',
  shouldUpdateOnDemand = true,
}: Pick<
  APIDataProps,
  'formData' | 'previewToken' | 'paymentIntent' | 'referrer' | 'shouldUpdateOnDemand'
>): CheckoutAPIData {
  let {onDemandBudget} = formData;
  if (onDemandBudget) {
    onDemandBudget = normalizeOnDemandBudget(onDemandBudget);
  }
  return getCheckoutAPIData({
    formData,
    onDemandBudget,
    previewToken,
    paymentIntent,
    referrer,
    shouldUpdateOnDemand,
  });
}

export function useSubmitCheckout({
  organization,
  subscription,
  previewData,
  onErrorMessage,
  onSubmitting,
  onHandleCardAction,
  onFetchPreviewData,
  onSuccess,
  referrer = 'billing',
}: {
  onErrorMessage: (message: string) => void;
  onFetchPreviewData: () => void;
  onHandleCardAction: ({intentDetails}: {intentDetails: IntentDetails}) => void;
  onSubmitting: (b: boolean) => void;
  onSuccess: ({
    isSubmitted,
    invoice,
    nextQueryParams,
    previewData,
  }: Pick<
    CheckoutState,
    'invoice' | 'nextQueryParams' | 'isSubmitted' | 'previewData'
  >) => void;
  organization: Organization;
  subscription: Subscription;
  previewData?: PreviewData;
  referrer?: string;
}) {
  const api = useApi({});

  // this is necessary for recording partner billing migration-specific analytics after
  // the migration is successful (during which the flag is flipped off)
  const isMigratingPartnerAccount = hasPartnerMigrationFeature(organization);

  return useMutation({
    mutationFn: ({data}: {data: CheckoutAPIData}) => {
      return api.requestPromise(
        `/customers/${organization.slug}/subscription/?expand=invoice`,
        {
          method: 'PUT',
          data,
        }
      );
    },
    onSuccess: (response, _variables) => {
      recordAnalytics(
        organization,
        subscription,
        _variables.data,
        isMigratingPartnerAccount
      );

      // seer automation alert
      const alreadyHasSeer =
        !isTrialPlan(subscription.plan) &&
        (subscription.addOns?.seer?.enabled || subscription.addOns?.legacySeer?.enabled);
      const justBoughtSeer =
        (_variables.data.addOnLegacySeer || _variables.data.addOnSeer) && !alreadyHasSeer;

      // refresh org and subscription state
      // useApi cancels open requests on unmount by default, so we create a new Client to ensure this
      // request doesn't get cancelled
      fetchOrganizationDetails(new Client(), organization.slug);
      SubscriptionStore.loadData(organization.slug);

      const {invoice} = response;
      const nextQueryParams = [referrer];
      if (justBoughtSeer) {
        nextQueryParams.push('showSeerAutomationAlert=true');
      }
      onSuccess({isSubmitted: true, invoice, nextQueryParams, previewData});
    },
    onError: (error: RequestError, _variables) => {
      const body = error.responseJSON;

      if (body?.previewToken) {
        onErrorMessage(
          t('Your preview expired, please review changes and submit again.')
        );
        onFetchPreviewData?.();
      } else if (body?.paymentIntent && body?.paymentSecret && body?.detail) {
        // When an error response contains payment intent information
        // we can retry the payment using the client-side confirmation flow
        // in stripe.
        // We don't re-enable the button here as we don't want users clicking it
        // while there are UI transitions happening.
        if (typeof body.detail === 'string') {
          onErrorMessage(body.detail);
        } else {
          onErrorMessage(
            body.detail.message ??
              t('An unknown error occurred while saving your subscription')
          );
        }
        const intent: IntentDetails = {
          paymentIntent: body.paymentIntent as string,
          paymentSecret: body.paymentSecret as string,
        };
        onHandleCardAction?.({intentDetails: intent});
      } else {
        if (typeof body?.detail === 'string') {
          onErrorMessage(body.detail);
        } else {
          onErrorMessage(
            body?.detail?.message ??
              t('An unknown error occurred while saving your subscription')
          );
        }
        onSubmitting?.(false);

        // TODO: add 402 ignoring once we've confirmed all valid error states
        Sentry.withScope(scope => {
          scope.setExtras({data: _variables.data});
          Sentry.captureException(error);
        });
      }
    },
  });
}

export function getContentForPlan(plan: Plan): PlanContent {
  if (isBizPlanFamily(plan)) {
    return {
      description: t('For teams that need more powerful debugging'),
      features: {
        discover: t('Advanced analytics with Discover'),
        enhanced_priority_alerts: t('Enhanced issue priority and alerting'),
        dashboard: t('Unlimited custom dashboards'),
        ...(getAmPlanTier(plan.id) === PlanTier.AM3 && {
          application_insights: t('Application Insights'),
        }),
        advanced_filtering: t('Advanced server-side filtering'),
        saml: t('SAML support'),
      },
      hasMoreLink: true,
    };
  }

  if (isTeamPlanFamily(plan)) {
    return {
      description: t('Everything to monitor your application as it scales'),
      features: {
        unlimited_members: t('Unlimited members'),
        integrations: t('Third-party integrations'),
        metric_alerts: t('Metric alerts'),
      },
    };
  }

  // TODO(billing): update copy when Developer is available in checkout
  return {
    description: t('For solo devs working on small projects'),
    features: {
      errors: t('5K Errors'),
      replays: t('50 Replays'),
      spans: t('5M Spans'),
      attachments: t('1GB Attachments'),
      monitorSeats: t('1 Cron Monitor'),
      uptime: t('1 Uptime Monitor'),
      logBytes: t('5GB Logs'),
    },
  };
}

export function invoiceItemTypeToDataCategory(
  type: InvoiceItemType
): DataCategory | null {
  if (!type.startsWith('reserved_') && !type.startsWith('ondemand_')) {
    return null;
  }
  return camelCase(
    type.replace('reserved_', '').replace('ondemand_', '')
  ) as DataCategory;
}

export function reservedInvoiceItemTypeToAddOn(
  type: InvoiceItemType
): AddOnCategory | null {
  switch (type) {
    case 'reserved_seer_budget':
      return AddOnCategory.LEGACY_SEER;
    case 'reserved_seer_users':
      return AddOnCategory.SEER;
    default:
      return null;
  }
}

/**
 * Returns true if the subscription has either a payment source or some billing details set.
 */
export function hasBillingInfo(
  billingDetails: BillingDetails | undefined,
  subscription: Subscription,
  isComplete: boolean
) {
  if (subscription.isSelfServePartner) {
    return true;
  }

  if (isComplete) {
    return !!subscription.paymentSource && hasSomeBillingDetails(billingDetails);
  }
  return !!subscription.paymentSource || hasSomeBillingDetails(billingDetails);
}

/**
 * Get the prepaid price for an add-on
 */
export function getPrepaidPriceForAddOn({
  addOnCategory,
  plan,
}: {
  addOnCategory: AddOnCategory;
  plan: Plan;
}) {
  const reservedBudgetCategory = getReservedBudgetCategoryForAddOn(addOnCategory);
  if (reservedBudgetCategory) {
    return getReservedPriceForReservedBudgetCategory({
      plan,
      reservedBudgetCategory,
    });
  }

  // if it's not a reserved budget add on, we assume it's a PAYG only add on (costs $0)
  return 0;
}
