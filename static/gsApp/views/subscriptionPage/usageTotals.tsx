import {Fragment, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import colorFn from 'color';

import {Container} from '@sentry/scraps/layout';

import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {IconChevron, IconLock} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import getDaysSinceDate from 'sentry/utils/getDaysSinceDate';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';
import {capitalize} from 'sentry/utils/string/capitalize';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';

import ProductTrialTag from 'getsentry/components/productTrial/productTrialTag';
import StartTrialButton from 'getsentry/components/startTrialButton';
import {GIGABYTE, UNLIMITED, UNLIMITED_RESERVED} from 'getsentry/constants';
import type {
  BillingMetricHistory,
  BillingStatTotal,
  EventBucket,
  ProductTrial,
  ReservedBudget,
  Subscription,
} from 'getsentry/types';
import {PlanTier, ReservedBudgetCategoryType} from 'getsentry/types';
import {
  addBillingStatTotals,
  displayBudgetName,
  formatReservedWithUnits,
  formatUsageWithUnits,
  getActiveProductTrial,
  getPercentage,
  getPotentialProductTrial,
  isAm2Plan,
  isUnlimitedReserved,
  MILLISECONDS_IN_HOUR,
} from 'getsentry/utils/billing';
import {
  getChunkCategoryFromDuration,
  getPlanCategoryName,
  isByteCategory,
  isContinuousProfiling,
  isPartOfReservedBudget,
} from 'getsentry/utils/dataCategory';
import formatCurrency from 'getsentry/utils/formatCurrency';
import {roundUpToNearestDollar} from 'getsentry/utils/roundUpToNearestDollar';
import titleCase from 'getsentry/utils/titleCase';
import {displayPriceWithCents, getBucket} from 'getsentry/views/amCheckout/utils';
import {
  getOnDemandBudget,
  hasOnDemandBudgetsFeature,
  parseOnDemandBudgetsFromSubscription,
} from 'getsentry/views/onDemandBudgets/utils';
import UsageTotalsTable from 'getsentry/views/subscriptionPage/usageTotalsTable';
import {
  calculateCategorySpend,
  calculateTotalSpend,
} from 'getsentry/views/subscriptionPage/utils';

export const EMPTY_STAT_TOTAL = {
  accepted: 0,
  dropped: 0,
  droppedOther: 0,
  droppedOverQuota: 0,
  droppedSpikeProtection: 0,
  filtered: 0,
  projected: 0,
};

type UsageProps = {
  /**
   * The data category to display
   */
  category: DataCategory;
  displayMode: 'usage' | 'cost';
  organization: Organization;
  subscription: Subscription;
  /**
   * Do not allow the table to be expanded
   */
  disableTable?: boolean;
  /**
   * Event breakdown totals used by Performance Units
   */
  eventTotals?: Record<string, BillingStatTotal>;
  /**
   * Gifted events for the current billing period.
   */
  freeUnits?: number;
  /**
   * Total events allowed for the current usage period including gifted
   */
  prepaidUnits?: number;
  /**
   * The reserved amount or null if the account doesn't have this category.
   */
  reservedUnits?: number | null;
  /**
   * Show event breakdown
   */
  showEventBreakdown?: boolean;
  /**
   * If soft cap is enabled, the type of soft cap in use: true forward or on-demand
   */
  softCapType?: 'ON_DEMAND' | 'TRUE_FORWARD' | null;
  /**
   * Usage totals.
   */
  totals?: BillingStatTotal;
  /**
   * Whether this category has True Forward
   */
  trueForward?: boolean;
};

type CombinedUsageProps = {
  /**
   * Stat totals by category
   */
  allTotalsByCategory: Record<string, BillingStatTotal>;
  organization: Organization;
  /**
   * The product group to display
   */
  productGroup: ReservedBudget;
  subscription: Subscription;
  /**
   * Gifted budget for the current billing period.
   */
  freeBudget?: number | null;
  /**
   * The reserved budget if any
   */
  reservedBudget?: number | null;
  /**
   * The reserved spend if any
   */
  reservedSpend?: number | null;
  /**
   * If soft cap is enabled, the type of soft cap in use: true forward or on-demand
   */
  softCapType?: 'ON_DEMAND' | 'TRUE_FORWARD' | null;
  /**
   * Whether this category has True Forward
   */
  trueForward?: boolean;
};

type State = {expanded: boolean; trialButtonBusy: boolean};

/**
 * Calculates usage metrics for a subscription category's prepaid (reserved) events.
 *
 * @param category - The data category to calculate usage for (e.g. 'errors', 'transactions')
 * @param subscription - The subscription object containing plan and usage details
 * @param accepted - The accepted event count for this category
 * @param prepaid - The prepaid/reserved event limit (volume-based reserved) or commited spend (budget-based reserved) for this category
 * @param reservedCpe - The reserved cost-per-event for this category (for reserved budget categories), in cents
 * @param reservedSpend - The reserved spend for this category (for reserved budget categories). If provided, calculations with `totals` and `reservedCpe` are overriden to use the number provided for `prepaidSpend`
 *
 * @returns Object containing:
 *   - onDemandUsage: Number of events that exceeded the prepaid limit and went to on-demand
 *   - prepaidPercentUsed: Percentage of prepaid limit used (0-100)
 *   - prepaidPrice: Monthly cost of the prepaid events (reserved budget if it is a reserved budget category)
 *   - prepaidSpend: Cost of prepaid events used so far this period
 *   - prepaidUsage: Number of events used within prepaid limit
 */
export function calculateCategoryPrepaidUsage(
  category: DataCategory,
  subscription: Subscription,
  prepaid: number,
  accepted?: number | null,
  reservedCpe?: number | null,
  reservedSpend?: number | null
): {
  onDemandUsage: number;
  prepaidPercentUsed: number;
  prepaidPrice: number;
  /**
   * Total category spend this period
   */
  prepaidSpend: number;
  prepaidUsage: number;
} {
  const categoryInfo: BillingMetricHistory | undefined =
    subscription.categories[category];
  const usage = accepted ?? categoryInfo?.usage ?? 0;

  // If reservedCpe or reservedSpend aren't provided but category is part of a reserved budget,
  // try to extract them from subscription.reservedBudgets
  let effectiveReservedCpe = reservedCpe ?? undefined;
  let effectiveReservedSpend = reservedSpend ?? undefined;

  if (
    (effectiveReservedCpe === undefined || effectiveReservedSpend === undefined) &&
    isPartOfReservedBudget(category, subscription.reservedBudgets ?? [])
  ) {
    // Look for the category in reservedBudgets
    for (const budget of subscription.reservedBudgets || []) {
      if (category in budget.categories) {
        const categoryBudget = budget.categories[category];
        if (categoryBudget) {
          if (effectiveReservedCpe === undefined) {
            effectiveReservedCpe = categoryBudget.reservedCpe;
          }
          if (effectiveReservedSpend === undefined) {
            effectiveReservedSpend = categoryBudget.reservedSpend;
          }
          break;
        }
      }
    }
  }

  // Calculate the prepaid total
  let prepaidTotal: any;
  if (isUnlimitedReserved(prepaid)) {
    prepaidTotal = prepaid;
  } else {
    // Convert prepaid limits to the appropriate unit based on category
    prepaidTotal =
      prepaid *
      (isByteCategory(category)
        ? GIGABYTE
        : isContinuousProfiling(category)
          ? MILLISECONDS_IN_HOUR
          : 1);
  }

  const hasReservedBudget = Boolean(
    reservedCpe || typeof effectiveReservedSpend === 'number'
  ); // reservedSpend can be 0

  const prepaidUsed = hasReservedBudget
    ? (effectiveReservedSpend ?? usage * (effectiveReservedCpe ?? 0))
    : usage;
  const prepaidPercentUsed = getPercentage(prepaidUsed, prepaidTotal);

  // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  const slots: EventBucket[] = subscription.planDetails.planCategories[category];

  // If the category billing info is not in the subscription, return 0 for all values
  // This seems to happen sometimes on partner accounts
  if (!categoryInfo || !slots) {
    return {
      prepaidPrice: 0,
      prepaidSpend: 0,
      prepaidPercentUsed: 0,
      onDemandUsage: 0,
      prepaidUsage: 0,
    };
  }

  // Get the price bucket for the reserved event amount
  const prepaidPriceBucket = getBucket({events: categoryInfo.reserved!, buckets: slots});

  // Convert annual prices to monthly if needed
  const isMonthly = subscription.planDetails.billingInterval === 'monthly';
  // This will be 0 when they are using the included amount
  const prepaidPrice = hasReservedBudget
    ? prepaid
    : (prepaidPriceBucket.price ?? 0) / (isMonthly ? 1 : 12);

  // Calculate spend based on percentage used
  const prepaidSpend = (prepaidPercentUsed / 100) * prepaidPrice;

  // Round the usage width to avoid half pixel artifacts
  const prepaidPercentUsedRounded = Math.round(prepaidPercentUsed);

  // Calculate on-demand usage if we've exceeded prepaid limit
  // No on-demand usage for unlimited reserved
  const onDemandUsage =
    (prepaidUsed > prepaidTotal && !isUnlimitedReserved(prepaidTotal)) ||
    (hasReservedBudget && prepaidUsed >= prepaidTotal)
      ? categoryInfo.onDemandQuantity
      : 0;
  const prepaidUsage = usage - onDemandUsage;

  return {
    prepaidPrice,
    prepaidSpend,
    prepaidPercentUsed: prepaidPercentUsedRounded,
    onDemandUsage,
    prepaidUsage,
  };
}

export function calculateCategoryOnDemandUsage(
  category: DataCategory,
  subscription: Subscription
): {
  /**
   * The maximum amount of on demand spend allowed for this category
   * This can be shared across all categories or specific to this category.
   * Other categories may have spent some of this budget making less avilable for this category.
   */
  onDemandCategoryMax: number;
  onDemandCategorySpend: number;
  /**
   * Will be the total on demand spend available for all categories if shared
   * or the total available for this category if not shared.
   */
  onDemandTotalAvailable: number;
  ondemandPercentUsed: number;
} {
  const onDemandBudgets = parseOnDemandBudgetsFromSubscription(subscription);
  const isSharedOnDemand = 'sharedMaxBudget' in onDemandBudgets;
  const onDemandTotalAvailable = isSharedOnDemand
    ? onDemandBudgets.sharedMaxBudget
    : getOnDemandBudget(onDemandBudgets, category);
  const {onDemandTotalSpent} = calculateTotalSpend(subscription);
  const {onDemandSpent: onDemandCategorySpend} = calculateCategorySpend(
    subscription,
    category
  );
  const onDemandCategoryMax = isSharedOnDemand
    ? // Subtract other category spend from shared on demand budget
      onDemandTotalAvailable - onDemandTotalSpent + onDemandCategorySpend
    : onDemandTotalAvailable;

  // Round the usage width to avoid half pixel artifacts
  const ondemandPercentUsed = Math.round(
    getPercentage(onDemandCategorySpend, onDemandCategoryMax)
  );

  return {
    onDemandTotalAvailable,
    onDemandCategorySpend,
    onDemandCategoryMax,
    ondemandPercentUsed,
  };
}

function ReservedUsage({
  prepaidUsage,
  reserved,
  category,
  productTrial,
}: {
  category: DataCategory;
  prepaidUsage: number;
  productTrial: ProductTrial | null;
  reserved: number | null;
}) {
  const reservedOptions = {
    isAbbreviated: category !== DataCategory.ATTACHMENTS,
  };

  return (
    <Fragment>
      {formatUsageWithUnits(prepaidUsage, category, {
        isAbbreviated: true,
      })}{' '}
      of{' '}
      {productTrial?.isStarted && getDaysSinceDate(productTrial.endDate ?? '') <= 0
        ? UNLIMITED
        : formatReservedWithUnits(reserved, category, reservedOptions)}
    </Fragment>
  );
}

export function UsageTotals({
  category,
  subscription,
  organization,
  freeUnits = 0,
  prepaidUnits = 0,
  reservedUnits = null,
  softCapType = null,
  totals = EMPTY_STAT_TOTAL,
  eventTotals = {},
  trueForward = false,
  showEventBreakdown = false,
  disableTable,
  displayMode,
}: UsageProps) {
  const [state, setState] = useState<State>({expanded: false, trialButtonBusy: false});
  const theme = useTheme();
  const colors = theme.chart.getColorPalette(5);

  const COLORS = {
    reserved: colors[0],
    ondemand: colors[1],
    secondary_reserved: colors[2],
  } as const;

  const usageOptions = {useUnitScaling: true};
  const reservedOptions = {
    isAbbreviated: category !== DataCategory.ATTACHMENTS,
  };

  const free = freeUnits;
  const reserved = reservedUnits;
  const prepaid = prepaidUnits;

  const displayGifts = !!(free && !isUnlimitedReserved(reservedUnits));
  const reservedTestId = displayGifts ? `gifted-${category}` : `reserved-${category}`;
  const hasOnDemand =
    hasOnDemandBudgetsFeature(organization, subscription) ||
    subscription.planTier === PlanTier.AM3;
  const onDemandBudgets = parseOnDemandBudgetsFromSubscription(subscription);
  const totalMaxOndemandBudget =
    'sharedMaxBudget' in onDemandBudgets
      ? onDemandBudgets.sharedMaxBudget
      : getOnDemandBudget(onDemandBudgets, category);

  const {onDemandSpent: categoryOnDemandSpent, onDemandUnitPrice} =
    calculateCategorySpend(subscription, category);

  function getReservedInfo() {
    let reservedInfo = tct('[reserved] Reserved', {
      reserved: formatReservedWithUnits(reserved, category, reservedOptions),
    });
    if (softCapType) {
      const softCapName = titleCase(softCapType.replace(/_/g, ' '));
      reservedInfo = tct('[reservedInfo] ([softCapName])', {reservedInfo, softCapName});
    }
    // Fallback if softCapType was not set but True Forward is
    else if (trueForward) {
      reservedInfo = tct('[reservedInfo] (True Forward)', {reservedInfo});
    }
    if (displayGifts) {
      reservedInfo = hasReservedQuota
        ? tct('[reservedInfo] + [giftedAmount] Gifted', {
            reservedInfo,
            giftedAmount: formatReservedWithUnits(free, category, reservedOptions),
          })
        : tct('[giftedAmount] Gifted', {
            giftedAmount: formatReservedWithUnits(free, category, reservedOptions),
          });
    }
    return reservedInfo;
  }

  const productTrial =
    getActiveProductTrial(subscription.productTrials ?? null, category) ??
    getPotentialProductTrial(subscription.productTrials ?? null, category);

  const {
    ondemandPercentUsed,
    onDemandTotalAvailable,
    onDemandCategorySpend,
    onDemandCategoryMax,
  } = calculateCategoryOnDemandUsage(category, subscription);
  const unusedOnDemandWidth = 100 - ondemandPercentUsed;
  const categoryInfo: BillingMetricHistory | undefined =
    subscription.categories[category];
  const usage = categoryInfo?.usage ?? 0;
  const {prepaidPrice, prepaidPercentUsed, prepaidUsage, onDemandUsage} =
    calculateCategoryPrepaidUsage(category, subscription, prepaid, null, undefined, null);
  const unusedPrepaidWidth =
    reserved !== 0 || subscription.isTrial ? 100 - prepaidPercentUsed : 100;
  const totalCategorySpend = prepaidPrice + categoryOnDemandSpent;

  // Shared on demand spend is gone, another category has spent all of it
  // It is confusing to show on demand spend when the category did not spend any and the budget is gone
  const onDemandIsGoneAndCategorySpentNone =
    'sharedMaxBudget' in onDemandBudgets &&
    categoryOnDemandSpent === 0 &&
    onDemandCategoryMax === 0;

  // Don't show on demand when:
  // - There is none left to spend and this category spent 0
  // - There is no on demand budget for this category
  // - There is no on demand budget at all
  const showOnDemand =
    !onDemandIsGoneAndCategorySpentNone && hasOnDemand && totalMaxOndemandBudget !== 0;

  const isDisplayingSpend = displayMode === 'cost';

  // Calculate the width of the reserved bar relative to on demand
  let reservedMaxWidth = showOnDemand ? (reserved === 0 ? 0 : 50) : 100;
  if (showOnDemand && reserved && onDemandUnitPrice) {
    const onDemandTotalUnitsAvailable = onDemandCategoryMax / onDemandUnitPrice;
    reservedMaxWidth =
      showOnDemand && reserved
        ? (reserved / (reserved + onDemandTotalUnitsAvailable)) * 100
        : 100;
  }

  function getTitle(): React.ReactNode {
    if (productTrial?.isStarted) {
      return t('trial usage this period');
    }

    if (isDisplayingSpend) {
      return t('spend this period');
    }

    return t('usage this period');
  }

  const formattedUnitsUsed = formatUsageWithUnits(usage, category, usageOptions);

  // use dropped profile chunks to estimate dropped continuous profiling
  // for AM3 plans, include profiles category to estimate dropped continuous profile hours
  const total = isContinuousProfiling(category)
    ? {
        ...addBillingStatTotals(totals, [
          eventTotals[getChunkCategoryFromDuration(category)] ?? EMPTY_STAT_TOTAL,
          !isAm2Plan(subscription.plan) && category === DataCategory.PROFILE_DURATION
            ? (eventTotals[DataCategory.PROFILES] ?? EMPTY_STAT_TOTAL)
            : EMPTY_STAT_TOTAL,
        ]),
        accepted: usage,
      }
    : {...totals, accepted: usage};

  const hasReservedQuota: boolean =
    reserved !== null && (reserved === UNLIMITED_RESERVED || reserved > 0);

  return (
    <Container
      background="primary"
      border="primary"
      radius="md"
      data-test-id={`usage-card-${category}`}
      padding="xl"
    >
      <CardBody>
        <UsageProgress>
          <BaseRow>
            <div>
              <UsageSummaryTitle>
                {getPlanCategoryName({
                  plan: subscription.planDetails,
                  category,
                })}{' '}
                {getTitle()}
                {productTrial && (
                  <MarginSpan>
                    <ProductTrialTag trial={productTrial} />
                  </MarginSpan>
                )}
              </UsageSummaryTitle>
              {(hasReservedQuota || displayGifts) && (
                <SubText data-test-id={reservedTestId}>
                  {productTrial?.isStarted &&
                  getDaysSinceDate(productTrial.endDate ?? '') <= 0
                    ? UNLIMITED
                    : getReservedInfo()}
                </SubText>
              )}
            </div>
            <AcceptedSummary>
              {productTrial && !productTrial.isStarted && (
                <MarginSpan>
                  <StartTrialButton
                    organization={organization}
                    source="usage-product-trials"
                    requestData={{
                      productTrial: {
                        category,
                        reasonCode: productTrial.reasonCode,
                      },
                    }}
                    aria-label={t('Start trial')}
                    priority="primary"
                    handleClick={() => {
                      setState({...state, trialButtonBusy: true});
                    }}
                    onTrialStarted={() => {
                      setState({...state, trialButtonBusy: true});
                    }}
                    onTrialFailed={() => {
                      setState({...state, trialButtonBusy: false});
                    }}
                    busy={state.trialButtonBusy}
                    disabled={state.trialButtonBusy}
                  />
                </MarginSpan>
              )}
              {!disableTable && (
                <Button
                  data-test-id={`expand-usage-totals-${category}`}
                  size="sm"
                  onClick={() => setState({...state, expanded: !state.expanded})}
                  icon={<IconChevron direction={state.expanded ? 'up' : 'down'} />}
                  aria-label={t('Expand usage totals')}
                />
              )}
            </AcceptedSummary>
          </BaseRow>
          <PlanUseBarContainer data-test-id={`usage-bar-container-${category}`}>
            <PlanUseBarGroup style={{width: `${reservedMaxWidth}%`}}>
              {prepaidPercentUsed >= 1 && (
                <Fragment>
                  {subscription?.reservedBudgets &&
                  subscription.hadCustomDynamicSampling &&
                  subscription.reservedBudgets.some(rb => category in rb.categories) ? (
                    // Show breakdown by category with the spans category first
                    subscription.reservedBudgets.map(rb =>
                      Object.entries(rb.categories)
                        .sort(([cat1], [cat2]) =>
                          cat1 === category ? -1 : cat2 === category ? 1 : 0
                        )
                        .map(([rbCategory, rbInfo]) => (
                          <PlanUseBar
                            key={rbCategory}
                            style={{
                              width: `${(rbInfo.reservedSpend / rb.reservedBudget) * 100}%`,
                              backgroundColor:
                                rbCategory === category
                                  ? COLORS.reserved
                                  : COLORS.secondary_reserved,
                            }}
                          />
                        ))
                    )
                  ) : (
                    <PlanUseBar
                      style={{
                        width: `${prepaidPercentUsed}%`,
                        backgroundColor: COLORS.reserved,
                      }}
                    />
                  )}
                </Fragment>
              )}
              {unusedPrepaidWidth >= 1 && (
                <PlanUseBar
                  style={{
                    width: `${unusedPrepaidWidth}%`,
                    backgroundColor: colorFn(COLORS.reserved).fade(0.5).string(),
                  }}
                />
              )}
            </PlanUseBarGroup>
            {showOnDemand && (
              <PlanUseBarGroup style={{width: `${100 - reservedMaxWidth}%`}}>
                {ondemandPercentUsed >= 1 && (
                  <PlanUseBar
                    style={{
                      width: `${ondemandPercentUsed}%`,
                      backgroundColor: COLORS.ondemand,
                    }}
                  />
                )}
                {unusedOnDemandWidth >= 1 && (
                  <PlanUseBar
                    style={{
                      width: `${unusedOnDemandWidth}%`,
                      backgroundColor: colorFn(COLORS.ondemand).fade(0.5).string(),
                    }}
                  />
                )}
              </PlanUseBarGroup>
            )}
          </PlanUseBarContainer>

          <LegendFooterWrapper>
            <LegendPriceWrapper>
              {hasReservedQuota && (
                <LegendContainer>
                  <LegendDot style={{backgroundColor: COLORS.reserved}} />
                  {isDisplayingSpend ? (
                    prepaidPrice === 0 ? (
                      <div>
                        <LegendTitle>{t('Included in Subscription')}</LegendTitle>
                        <LegendPriceSubText>
                          <ReservedUsage
                            prepaidUsage={prepaidUsage}
                            reserved={reserved}
                            category={category}
                            productTrial={productTrial}
                          />
                        </LegendPriceSubText>
                      </div>
                    ) : (
                      <LegendContainer>
                        <div>
                          <LegendTitle>{t('Included in Subscription')}</LegendTitle>
                          <LegendPrice>
                            {formatPercentage(prepaidPercentUsed / 100)} of{' '}
                            {prepaidPrice === 0
                              ? reserved
                              : formatCurrency(roundUpToNearestDollar(prepaidPrice))}
                          </LegendPrice>
                        </div>
                      </LegendContainer>
                    )
                  ) : hasReservedQuota ? (
                    <div>
                      <LegendTitle>{t('Included in Subscription')}</LegendTitle>
                      <LegendPrice>
                        <ReservedUsage
                          prepaidUsage={prepaidUsage}
                          reserved={reserved}
                          category={category}
                          productTrial={productTrial}
                        />
                      </LegendPrice>
                    </div>
                  ) : null}
                </LegendContainer>
              )}
              {showOnDemand && (
                <LegendContainer>
                  <LegendDot style={{backgroundColor: COLORS.ondemand}} />
                  {isDisplayingSpend ? (
                    <div>
                      <LegendTitle>
                        {displayBudgetName(subscription.planDetails, {title: true})}
                      </LegendTitle>
                      <LegendPrice>
                        {formatCurrency(onDemandCategorySpend)} of{' '}
                        {formatCurrency(onDemandCategoryMax)}{' '}
                        {/* Shared on demand was used in another category, display the max */}
                        {onDemandTotalAvailable !== onDemandCategoryMax && (
                          <Fragment>
                            ({formatCurrency(onDemandTotalAvailable)} max)
                          </Fragment>
                        )}
                      </LegendPrice>
                    </div>
                  ) : (
                    <div>
                      <LegendTitle>
                        {displayBudgetName(subscription.planDetails, {title: true})}
                      </LegendTitle>
                      <LegendPrice>
                        {formatUsageWithUnits(onDemandUsage, category, usageOptions)}
                      </LegendPrice>
                    </div>
                  )}
                </LegendContainer>
              )}
            </LegendPriceWrapper>
            {isDisplayingSpend ? (
              <TotalSpendWrapper>
                <UsageSummaryTitle>
                  {formatCurrency(totalCategorySpend)}
                </UsageSummaryTitle>
                <TotalSpendLabel>
                  {prepaidPrice !== 0 && (
                    <Fragment>
                      {formatCurrency(prepaidPrice)} {t('Included in Subscription')}
                    </Fragment>
                  )}
                  {prepaidPrice !== 0 && showOnDemand && <Fragment> + </Fragment>}
                  {showOnDemand && (
                    <Fragment>
                      {formatCurrency(onDemandCategorySpend)}{' '}
                      {displayBudgetName(subscription.planDetails, {title: true})}
                    </Fragment>
                  )}
                </TotalSpendLabel>
              </TotalSpendWrapper>
            ) : (
              <TotalSpendWrapper>
                <UsageSummaryTitle>{formattedUnitsUsed}</UsageSummaryTitle>
                <TotalSpendLabel>{t('Total Usage')}</TotalSpendLabel>
              </TotalSpendWrapper>
            )}
          </LegendFooterWrapper>
        </UsageProgress>
      </CardBody>
      {state.expanded && !disableTable && (
        <Fragment>
          <UsageTotalsTable
            category={category}
            totals={total}
            subscription={subscription}
          />

          {showEventBreakdown &&
            Object.entries(eventTotals).map(([key, eventTotal]) => {
              return (
                <UsageTotalsTable
                  isEventBreakdown
                  key={key}
                  category={key as DataCategory}
                  totals={eventTotal}
                  subscription={subscription}
                  data-test-id={`event-breakdown-${key}`}
                />
              );
            })}
        </Fragment>
      )}
    </Container>
  );
}

export function CombinedUsageTotals({
  productGroup,
  subscription,
  organization,
  softCapType = null,
  allTotalsByCategory = {},
  trueForward = false,
}: CombinedUsageProps) {
  const [state, setState] = useState<State>({expanded: false, trialButtonBusy: false});
  const theme = useTheme();

  const colors = theme.chart.getColorPalette(5);
  const categoryToColors: Partial<
    Record<DataCategory, {ondemand: string; reserved: string}>
  > = {};

  Object.keys(productGroup.categories).forEach((category, index) => {
    // NOTE: this can only handle a max of 3 categories, as there aren't any more colors in the palette
    categoryToColors[category as DataCategory] = {
      reserved: colors[index]!,
      ondemand: colors[index + 2]!,
    };
  });

  const apiName = productGroup.apiName;
  const reservedBudget = productGroup.reservedBudget;
  const freeBudget = productGroup.freeBudget;
  const prepaidBudget = reservedBudget + freeBudget;
  const prepaidPercentUsed = productGroup.percentUsed;
  const unusedPrepaidWidth = 100 - prepaidPercentUsed * 100;

  const reservedTestId = freeBudget ? `gifted-${apiName}` : `reserved-${apiName}`;
  const hasOnDemand =
    hasOnDemandBudgetsFeature(organization, subscription) ||
    subscription.planTier === PlanTier.AM3;
  const onDemandBudgets = parseOnDemandBudgetsFromSubscription(subscription);
  const totalMaxOndemandBudget =
    'sharedMaxBudget' in onDemandBudgets
      ? onDemandBudgets.sharedMaxBudget
      : Object.keys(productGroup.categories).reduce(
          (acc, category) =>
            acc + getOnDemandBudget(onDemandBudgets, category as DataCategory),
          0
        );

  let totalOnDemandSpent = 0;
  let totalOnDemandMax = 0;
  let totalOnDemandPercentUsed = 0;
  Object.keys(productGroup.categories).forEach(category => {
    const {onDemandSpent} = calculateCategorySpend(
      subscription,
      category as DataCategory
    );
    totalOnDemandSpent += onDemandSpent;

    const {onDemandCategoryMax, ondemandPercentUsed} = calculateCategoryOnDemandUsage(
      category as DataCategory,
      subscription
    );
    totalOnDemandMax += onDemandCategoryMax;
    totalOnDemandPercentUsed += ondemandPercentUsed;
  });

  // Shared on demand spend is gone, another category has spent all of it
  // It is confusing to show on demand spend when the category did not spend any and the budget is gone
  const onDemandIsGoneAndCategorySpentNone =
    'sharedMaxBudget' in onDemandBudgets &&
    totalOnDemandSpent === 0 &&
    totalOnDemandMax === 0;

  // Don't show on demand when:
  // - There is none left to spend and this category spent 0
  // - There is no on demand budget for this category
  // - There is no on demand budget at all
  const showOnDemand =
    !onDemandIsGoneAndCategorySpentNone && hasOnDemand && totalMaxOndemandBudget !== 0;

  // Calculate the width of the reserved bar relative to on demand
  const reservedMaxWidth = showOnDemand ? (reservedBudget === 0 ? 0 : 50) : 100;
  const unusedOnDemandWidth = 100 - totalOnDemandPercentUsed;

  // doesn't matter which category we check for product trials
  const firstCategory = Object.keys(productGroup.categories)[0] as DataCategory;
  const productTrial =
    getActiveProductTrial(subscription.productTrials ?? null, firstCategory) ??
    getPotentialProductTrial(subscription.productTrials ?? null, firstCategory);
  const hasAvailableProductTrial = productTrial && !productTrial?.isStarted;

  const doesNotHaveProduct = reservedBudget === 0 && !productTrial?.isStarted;
  const canSelfServe = subscription.canSelfServe;
  const shouldUpsell = doesNotHaveProduct && canSelfServe && !productTrial?.isStarted;

  const shouldCompressCategories =
    apiName === ReservedBudgetCategoryType.DYNAMIC_SAMPLING &&
    !subscription.hadCustomDynamicSampling;
  const parentCategoryForCompression = shouldCompressCategories
    ? DataCategory.SPANS
    : undefined;
  const compressedReservedSpend = Object.values(productGroup.categories).reduce(
    (acc, categoryHistory) => acc + categoryHistory.reservedSpend,
    0
  );

  function getTitle(): React.ReactNode | null {
    if (productTrial?.isStarted) {
      return t('trial usage this period');
    }

    return null;
  }

  function getReservedInfo() {
    if (doesNotHaveProduct) {
      // TODO(reserved budgets): move this to frontend const similar to BILLED_DATA_CATEGORY_INFO
      if (apiName === ReservedBudgetCategoryType.SEER) {
        return t('Detect and fix issues faster with our AI debugging agent.');
      }
      return null;
    }
    let reservedInfo = tct('[reservedInfo] Reserved', {
      reservedInfo: displayPriceWithCents({cents: reservedBudget}),
    });
    if (softCapType) {
      const softCapName = titleCase(softCapType.replace(/_/g, ' '));
      reservedInfo = tct('[reservedInfo] ([softCapName])', {reservedInfo, softCapName});
    }
    // Fallback if softCapType was not set but True Forward is
    else if (trueForward) {
      reservedInfo = tct('[reservedInfo] (True Forward)', {reservedInfo});
    }
    if (freeBudget) {
      reservedInfo = tct('[reservedInfo] + [giftedAmount] Gifted', {
        reservedInfo,
        giftedAmount: displayPriceWithCents({cents: freeBudget}),
      });
    }
    return reservedInfo;
  }

  function getLegendGroup(legendType: 'reserved' | 'ondemand') {
    return (
      <CombinedLegendContainer>
        {Object.entries(productGroup.categories)
          .filter(
            ([category, _]) =>
              !shouldCompressCategories || category === parentCategoryForCompression
          )
          .map(([category, categoryInfo]) => {
            const {reserved: reservedColor, ondemand: ondemandColor} =
              categoryToColors[category as DataCategory] ?? {};
            const categoryName = getPlanCategoryName({
              plan: subscription.planDetails,
              category: category as DataCategory,
              hadCustomDynamicSampling: subscription.hadCustomDynamicSampling,
              title: true,
              capitalize: false,
            });
            const {
              onDemandCategorySpend,
              onDemandCategoryMax,
              onDemandTotalAvailable,
            }: {
              onDemandCategoryMax: number;
              onDemandCategorySpend: number;
              onDemandTotalAvailable: number;
            } =
              legendType === 'reserved'
                ? {
                    onDemandCategorySpend: 0,
                    onDemandCategoryMax: 0,
                    onDemandTotalAvailable: 0,
                  }
                : calculateCategoryOnDemandUsage(category as DataCategory, subscription);

            return (
              <LegendBudgetContainer key={category}>
                <LegendDot
                  style={{
                    backgroundColor:
                      legendType === 'reserved' ? reservedColor : ondemandColor,
                  }}
                />
                <LegendTitle>
                  {legendType === 'reserved'
                    ? `${categoryName} ${t('Included in Subscription')}`
                    : `${displayBudgetName(subscription.planDetails, {title: true})} ${categoryName}`}
                </LegendTitle>
                <div />
                <LegendPriceSubText>
                  {legendType === 'reserved'
                    ? productTrial?.isStarted &&
                      getDaysSinceDate(productTrial.endDate ?? '') <= 0
                      ? `0 of ${UNLIMITED}`
                      : `${formatPercentage(
                          Math.round(
                            (shouldCompressCategories
                              ? productGroup.percentUsed
                              : categoryInfo.reservedSpend /
                                (prepaidBudget === 0 ? 1 : prepaidBudget)) * 100
                          ) / 100
                        )} of
                ${
                  prepaidBudget === 0
                    ? 0
                    : formatCurrency(roundUpToNearestDollar(prepaidBudget))
                }`
                    : /* Shared on demand was used in another category, display the max */
                      `${formatCurrency(onDemandCategorySpend)} of
                    ${formatCurrency(onDemandCategoryMax)}
                    ${
                      onDemandTotalAvailable === onDemandCategoryMax
                        ? ''
                        : ` (${formatCurrency(onDemandTotalAvailable)} max)`
                    }
                    `}
                </LegendPriceSubText>
              </LegendBudgetContainer>
            );
          })}
      </CombinedLegendContainer>
    );
  }

  // match the unused bar to the last category in category order that has been used
  // for that budget; otherwise default to the first category in category 0order
  let categoryForUnusedPrepaid = firstCategory;
  let categoryForUnusedOnDemand = firstCategory;

  return (
    <Container
      background="primary"
      border="primary"
      radius="md"
      data-test-id={`usage-card-${apiName}`}
      padding="xl"
    >
      <CardBody>
        <UsageProgress>
          <BaseRow>
            <div>
              <UsageSummaryTitle>
                {capitalize(
                  apiName === ReservedBudgetCategoryType.SEER
                    ? productGroup.productName
                    : productGroup.name
                )}{' '}
                {getTitle()}
                {productTrial && (
                  <MarginSpan>
                    <ProductTrialTag trial={productTrial} />
                  </MarginSpan>
                )}
              </UsageSummaryTitle>
              {
                <SubText data-test-id={reservedTestId}>
                  {productTrial?.isStarted &&
                  getDaysSinceDate(productTrial.endDate ?? '') <= 0
                    ? UNLIMITED
                    : getReservedInfo()}
                </SubText>
              }
            </div>
            {shouldUpsell ? (
              hasAvailableProductTrial ? (
                <MarginSpan>
                  <StartTrialButton
                    organization={organization}
                    source="usage-product-trials"
                    requestData={{
                      productTrial: {
                        category: firstCategory, // doesn't matter which we pick
                        reasonCode: productTrial.reasonCode,
                      },
                    }}
                    aria-label={t('Start trial')}
                    priority="primary"
                    handleClick={() => {
                      setState({...state, trialButtonBusy: true});
                    }}
                    onTrialStarted={() => {
                      setState({...state, trialButtonBusy: true});
                    }}
                    onTrialFailed={() => {
                      setState({...state, trialButtonBusy: false});
                    }}
                    busy={state.trialButtonBusy}
                    disabled={state.trialButtonBusy}
                  />
                </MarginSpan>
              ) : (
                <LinkButton
                  data-test-id={`enable-${apiName}`}
                  size="sm"
                  to={`/checkout/${organization.slug}/?referrer=${apiName}-usage-card#step1`}
                  icon={<IconLock />}
                >
                  {tct('Enable [productName]', {
                    productName: toTitleCase(productGroup.productName),
                  })}
                </LinkButton>
              )
            ) : (
              !doesNotHaveProduct && (
                <AcceptedSummary>
                  <Button
                    data-test-id={`expand-usage-totals-${apiName}`}
                    size="sm"
                    onClick={() => setState({...state, expanded: !state.expanded})}
                    icon={<IconChevron direction={state.expanded ? 'up' : 'down'} />}
                    aria-label={t('Expand usage totals')}
                  />
                </AcceptedSummary>
              )
            )}
          </BaseRow>
          {doesNotHaveProduct ? (
            <LockedProductMessage data-test-id={`locked-product-message-${apiName}`}>
              <IconLock locked />
              {hasAvailableProductTrial
                ? tct('Start your [productName] trial to view usage', {
                    productName: toTitleCase(productGroup.productName),
                  })
                : canSelfServe
                  ? tct('Enable [productName] to view usage', {
                      productName: toTitleCase(productGroup.productName),
                    })
                  : tct(
                      'Contact us at [mailto:sales@sentry.io] to enable [productName].',
                      {
                        mailto: <a href="mailto:sales@sentry.io" />,
                        productName: toTitleCase(productGroup.productName),
                      }
                    )}
            </LockedProductMessage>
          ) : (
            <Fragment>
              <PlanUseBarContainer data-test-id={`usage-bar-container-${apiName}`}>
                <PlanUseBarGroup style={{width: `${reservedMaxWidth}%`}}>
                  {
                    <Fragment>
                      {shouldCompressCategories ? (
                        <PlanUseBar
                          style={{
                            width: `${(compressedReservedSpend / reservedBudget) * 100}%`,
                            backgroundColor:
                              categoryToColors[
                                parentCategoryForCompression as DataCategory
                              ]?.reserved,
                          }}
                          key={`${parentCategoryForCompression}-reserved`}
                        />
                      ) : (
                        Object.entries(productGroup.categories)
                          .filter(
                            ([category, _]) =>
                              !shouldCompressCategories ||
                              category === parentCategoryForCompression
                          )
                          .map(([rbCategory, rbInfo]) => {
                            if (rbInfo.reservedSpend > 0) {
                              categoryForUnusedPrepaid = rbCategory as DataCategory;
                              return (
                                <PlanUseBar
                                  style={{
                                    width: `${(rbInfo.reservedSpend / reservedBudget) * 100}%`,
                                    backgroundColor:
                                      categoryToColors[rbCategory as DataCategory]
                                        ?.reserved,
                                  }}
                                  key={`${rbCategory}-reserved`}
                                />
                              );
                            }
                            return null;
                          })
                      )}
                    </Fragment>
                  }
                  {unusedPrepaidWidth >= 1 && (
                    <PlanUseBar
                      style={{
                        width: `${unusedPrepaidWidth}%`,
                        backgroundColor: colorFn(
                          categoryToColors[categoryForUnusedPrepaid]?.reserved
                        )
                          .fade(0.5)
                          .string(),
                      }}
                    />
                  )}
                </PlanUseBarGroup>
                {showOnDemand && (
                  <PlanUseBarGroup style={{width: `${100 - reservedMaxWidth}%`}}>
                    {Object.keys(productGroup.categories).map(rbCategory => {
                      const {ondemandPercentUsed} = calculateCategoryOnDemandUsage(
                        rbCategory as DataCategory,
                        subscription
                      );

                      if (ondemandPercentUsed >= 1) {
                        categoryForUnusedOnDemand = rbCategory as DataCategory;
                        return (
                          <PlanUseBar
                            key={rbCategory}
                            style={{
                              width: `${ondemandPercentUsed}%`,
                              backgroundColor:
                                categoryToColors[rbCategory as DataCategory]?.ondemand,
                            }}
                          />
                        );
                      }
                      return null;
                    })}
                    {unusedOnDemandWidth >= 1 && (
                      <PlanUseBar
                        style={{
                          width: `${unusedOnDemandWidth}%`,
                          backgroundColor: colorFn(
                            categoryToColors[categoryForUnusedOnDemand]?.ondemand
                          )
                            .fade(0.5)
                            .string(),
                        }}
                      />
                    )}
                  </PlanUseBarGroup>
                )}
              </PlanUseBarContainer>
              <LegendFooterWrapper>
                <LegendPriceWrapper>
                  {getLegendGroup('reserved')}
                  {showOnDemand && getLegendGroup('ondemand')}
                </LegendPriceWrapper>
                {
                  <TotalSpendWrapper>
                    <UsageSummaryTitle>
                      {formatCurrency(
                        productGroup.totalReservedSpend + totalOnDemandSpent
                      )}
                    </UsageSummaryTitle>
                    <TotalSpendLabel>
                      {reservedBudget !== 0 && (
                        <Fragment>
                          {formatCurrency(reservedBudget)} {t('Included in Subscription')}
                        </Fragment>
                      )}
                      {reservedBudget !== 0 && showOnDemand && <Fragment> + </Fragment>}
                      {showOnDemand && (
                        <Fragment>
                          {formatCurrency(totalOnDemandSpent)}{' '}
                          {displayBudgetName(subscription.planDetails, {title: true})}
                        </Fragment>
                      )}
                    </TotalSpendLabel>
                  </TotalSpendWrapper>
                }
              </LegendFooterWrapper>
            </Fragment>
          )}
        </UsageProgress>
      </CardBody>
      {state.expanded && (
        <Fragment>
          {Object.keys(productGroup.categories).map(category => {
            if (shouldCompressCategories && category !== parentCategoryForCompression) {
              return null;
            }
            const billedUsage =
              subscription.categories?.[category as DataCategory]?.usage ?? 0;
            const totals = allTotalsByCategory?.[category] ?? EMPTY_STAT_TOTAL;
            const adjustedTotals = {
              ...totals,
              accepted: billedUsage,
            };

            return (
              <UsageTotalsTable
                key={category}
                category={category as DataCategory}
                totals={adjustedTotals}
                subscription={subscription}
              />
            );
          })}
        </Fragment>
      )}
    </Container>
  );
}

const CardBody = styled('div')`
  display: grid;
  align-items: center;
  gap: ${space(2)};
`;

const UsageSummaryTitle = styled('h4')`
  font-size: ${p => p.theme.fontSize.lg};
  margin-bottom: 0px;
  font-weight: 400;

  @media (min-width: ${p => p.theme.breakpoints.sm}) {
    font-size: ${p => p.theme.fontSize.xl};
  }
`;

const UsageProgress = styled('div')`
  display: grid;
  grid-auto-rows: auto;
  gap: ${space(1)};
`;

const BaseRow = styled('div')`
  display: grid;
  grid-template-columns: repeat(2, auto);
  justify-content: space-between;
  align-items: center;
  gap: ${space(1)};
`;

const SubText = styled('span')`
  color: ${p => p.theme.tokens.content.muted};
  font-size: ${p => p.theme.fontSize.md};
`;

const AcceptedSummary = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;

const MarginSpan = styled('span')`
  margin-left: ${space(0.5)};
  margin-right: ${space(1)};
`;

const TotalSpendWrapper = styled('div')`
  text-align: right;
`;

const TotalSpendLabel = styled('div')`
  color: ${p => p.theme.subText};
`;

const LegendFooterWrapper = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: ${space(1)};
`;

const LegendPriceWrapper = styled('div')`
  display: flex;
  gap: ${space(1)};
`;

const LegendDot = styled('div')`
  border-radius: 100%;
  width: 10px;
  height: 10px;
`;

const LegendContainer = styled('div')`
  display: grid;
  grid-template-columns: min-content 1fr;
  gap: ${space(1)};
  align-items: baseline;
`;

const CombinedLegendContainer = styled('div')`
  display: flex;
  gap: ${space(1)};
  align-items: baseline;
  flex-wrap: wrap;
`;

const LegendTitle = styled('div')`
  font-weight: 700;
  font-size: ${p => p.theme.fontSize.sm};
  white-space: nowrap;
`;

const LegendPrice = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
`;

const LegendPriceSubText = styled(LegendPrice)`
  color: ${p => p.theme.subText};
`;

const LegendBudgetContainer = styled('div')`
  display: grid;
  grid-template-columns: min-content 1fr;
  align-items: baseline;
  column-gap: ${space(1)};
  white-space: nowrap;
`;
const PlanUseBarContainer = styled('div')`
  display: flex;
  height: 16px;
  width: 100%;
  overflow: hidden;
  gap: 2px;
`;

const PlanUseBarGroup = styled('div')`
  display: flex;
  gap: 2px;
`;

const PlanUseBar = styled('div')`
  height: 100%;
`;

const LockedProductMessage = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${p => p.theme.backgroundSecondary};
  padding: ${space(1.5)};
  gap: ${space(1)};
  line-height: initial;
  color: ${p => p.theme.subText};
`;
