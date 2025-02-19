import {Fragment, useState} from 'react';
import styled from '@emotion/styled';
import colorFn from 'color';

import {Button} from 'sentry/components/button';
import Card from 'sentry/components/card';
import {CHART_PALETTE} from 'sentry/constants/chartPalette';
import {IconChevron} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import getDaysSinceDate from 'sentry/utils/getDaysSinceDate';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';

import ProductTrialTag from 'getsentry/components/productTrial/productTrialTag';
import StartTrialButton from 'getsentry/components/startTrialButton';
import {GIGABYTE, RESERVED_BUDGET_QUOTA, UNLIMITED} from 'getsentry/constants';
import {
  type BillingMetricHistory,
  type BillingStatTotal,
  type EventBucket,
  PlanTier,
  type ProductTrial,
  type Subscription,
} from 'getsentry/types';
import {
  formatReservedWithUnits,
  formatUsageWithUnits,
  getActiveProductTrial,
  getPotentialProductTrial,
  isUnlimitedReserved,
  MILLISECONDS_IN_HOUR,
} from 'getsentry/utils/billing';
import {getPlanCategoryName} from 'getsentry/utils/dataCategory';
import formatCurrency from 'getsentry/utils/formatCurrency';
import {roundUpToNearestDollar} from 'getsentry/utils/roundUpToNearestDollar';
import titleCase from 'getsentry/utils/titleCase';
import {getBucket} from 'getsentry/views/amCheckout/utils';
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

const EMPTY_STAT_TOTAL = {
  accepted: 0,
  dropped: 0,
  droppedOther: 0,
  droppedOverQuota: 0,
  droppedSpikeProtection: 0,
  filtered: 0,
  projected: 0,
};

const COLORS = {
  reserved: CHART_PALETTE[5]![0]!,
  ondemand: CHART_PALETTE[5]![1]!,
} as const;

function getPercentage(quantity: number, total: number | null) {
  if (typeof total === 'number' && total > 0) {
    return (Math.min(quantity, total) / total) * 100;
  }
  return 0;
}

export function displayPercentage(quantity: number, total: number | null) {
  const percentage = getPercentage(quantity, total);
  return percentage.toFixed(0) + '%';
}

type UsageProps = {
  /**
   * The data category to display
   */
  category: string;
  displayMode: 'usage' | 'cost';
  organization: Organization;
  subscription: Subscription;
  /**
   * Do not allow the table to be expansded
   */
  disableTable?: boolean;
  /**
   * Event breakdown totals
   */
  eventTotals?: {[key: string]: BillingStatTotal};
  /**
   * Gifted budget for the current billing period.
   */
  freeBudget?: number;
  /**
   * Gifted events for the current billing period.
   */
  freeUnits?: number;
  /**
   * The prepaid budget (reserved + gifted) if any
   */
  prepaidBudget?: number;
  /**
   * Total events allowed for the current usage period including gifted
   */
  prepaidUnits?: number;
  /**
   * The reserved budget if any
   */
  reservedBudget?: number;
  /**
   * The reserved cpe if any
   */
  reservedCpe?: number;
  /**
   * The reserved spend if any
   */
  reservedSpend?: number;
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

type State = {expanded: boolean; trialButtonBusy: boolean};

/**
 * Calculates usage metrics for a subscription category's prepaid (reserved) events.
 *
 * @param category - The data category to calculate usage for (e.g. 'errors', 'transactions')
 * @param subscription - The subscription object containing plan and usage details
 * @param totals - Object containing the accepted event count for this category
 * @param prepaid - The prepaid/reserved event limit (volume-based reserved) or commited spend (budget-based reserved) for this category
 * @param reservedCpe - The reserved cost-per-event for this category (for reserved budget categories)
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
  category: string,
  subscription: Subscription,
  totals: Pick<BillingStatTotal, 'accepted'>,
  prepaid: number,
  reservedCpe?: number,
  reservedSpend?: number
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
  // Calculate the prepaid total
  let prepaidTotal: any;
  if (isUnlimitedReserved(prepaid)) {
    prepaidTotal = prepaid;
  } else {
    // Convert prepaid limits to the appropriate unit based on category
    switch (category) {
      case DataCategory.ATTACHMENTS:
        prepaidTotal = prepaid * GIGABYTE;
        break;
      case DataCategory.PROFILE_DURATION:
        prepaidTotal = prepaid * MILLISECONDS_IN_HOUR;
        break;
      default:
        prepaidTotal = prepaid;
    }
  }
  const hasReservedBudget = reservedCpe || reservedSpend;
  const prepaidUsed = hasReservedBudget
    ? reservedSpend ?? totals.accepted * (reservedCpe ?? 0)
    : totals.accepted;
  const prepaidPercentUsed = getPercentage(prepaidUsed, prepaidTotal);

  // Calculate the prepaid price
  // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  const categoryInfo: BillingMetricHistory = subscription.categories[category];
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
  const prepaidUsage = totals.accepted - onDemandUsage;

  return {
    prepaidPrice,
    prepaidSpend,
    prepaidPercentUsed: prepaidPercentUsedRounded,
    onDemandUsage,
    prepaidUsage,
  };
}

export function calculateCategoryOnDemandUsage(
  category: string,
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
    : getOnDemandBudget(onDemandBudgets, category as DataCategory);
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
  category: string;
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

function UsageTotals({
  category,
  subscription,
  organization,
  freeUnits = 0,
  prepaidUnits = 0,
  reservedUnits = null,
  freeBudget = 0,
  prepaidBudget = 0,
  reservedBudget = 0,
  reservedSpend = 0,
  softCapType = null,
  totals = EMPTY_STAT_TOTAL,
  eventTotals = {},
  trueForward = false,
  showEventBreakdown = false,
  disableTable,
  displayMode,
}: UsageProps) {
  const [state, setState] = useState<State>({expanded: false, trialButtonBusy: false});

  const usageOptions = {useUnitScaling: true};
  const reservedOptions = {
    isAbbreviated: category !== DataCategory.ATTACHMENTS,
  };

  const hasReservedBudget = reservedUnits === RESERVED_BUDGET_QUOTA;
  const free = hasReservedBudget ? freeBudget : freeUnits;
  const reserved = hasReservedBudget ? reservedBudget : reservedUnits;
  const prepaid = hasReservedBudget ? prepaidBudget : prepaidUnits;

  const displayGifts = (free || freeBudget) && !isUnlimitedReserved(reservedUnits);
  const reservedTestId = displayGifts ? `gifted-${category}` : `reserved-${category}`;
  const hasOnDemand =
    hasOnDemandBudgetsFeature(organization, subscription) ||
    subscription.planTier === PlanTier.AM3;
  const onDemandBudgets = parseOnDemandBudgetsFromSubscription(subscription);
  const totalMaxOndemandBudget =
    'sharedMaxBudget' in onDemandBudgets
      ? onDemandBudgets.sharedMaxBudget
      : getOnDemandBudget(onDemandBudgets, category as DataCategory);

  const {onDemandSpent: categoryOnDemandSpent, onDemandUnitPrice} =
    calculateCategorySpend(subscription, category);

  function getReservedInfo() {
    let reservedInfo = tct('[reserved] Reserved', {
      reserved: formatReservedWithUnits(
        reserved,
        category,
        reservedOptions,
        hasReservedBudget
      ),
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
      reservedInfo = tct('[reservedInfo] + [giftedAmount] Gifted', {
        reservedInfo,
        giftedAmount: formatReservedWithUnits(
          free,
          category,
          reservedOptions,
          hasReservedBudget
        ),
      });
    }
    return reservedInfo;
  }

  const productTrial =
    getActiveProductTrial(subscription.productTrials ?? null, category as DataCategory) ??
    getPotentialProductTrial(
      subscription.productTrials ?? null,
      category as DataCategory
    );

  const {
    ondemandPercentUsed,
    onDemandTotalAvailable,
    onDemandCategorySpend,
    onDemandCategoryMax,
  } = calculateCategoryOnDemandUsage(category, subscription);
  const unusedOnDemandWidth = 100 - ondemandPercentUsed;

  const {prepaidPrice, prepaidPercentUsed, prepaidUsage, onDemandUsage} =
    calculateCategoryPrepaidUsage(
      category,
      subscription,
      totals,
      prepaid,
      undefined,
      reservedSpend
    );
  const unusedPrepaidWidth =
    reserved !== 0 || subscription.isTrial ? 100 - prepaidPercentUsed : 0;
  const totalCategorySpend =
    (hasReservedBudget ? reservedSpend : prepaidPrice) + categoryOnDemandSpent;

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

  const isDisplayingSpend = displayMode === 'cost' || hasReservedBudget; // always display as spend for reserved budgets

  // Calculate the width of the reserved bar relative to on demand
  let reservedMaxWidth = showOnDemand ? (reserved !== 0 ? 50 : 0) : 100;
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

  const formattedUnitsUsed = formatUsageWithUnits(
    totals.accepted,
    category,
    usageOptions
  );

  return (
    <SubscriptionCard>
      <CardBody>
        <UsageProgress>
          <BaseRow>
            <div>
              <UsageSummaryTitle>
                {getPlanCategoryName({
                  plan: subscription.planDetails,
                  category,
                  hadCustomDynamicSampling: subscription.hadCustomDynamicSampling,
                })}{' '}
                {getTitle()}
                {productTrial && (
                  <MarginSpan>
                    <ProductTrialTag trial={productTrial} />
                  </MarginSpan>
                )}
              </UsageSummaryTitle>
              <SubText data-test-id={reservedTestId}>
                {productTrial?.isStarted &&
                getDaysSinceDate(productTrial.endDate ?? '') <= 0
                  ? UNLIMITED
                  : getReservedInfo()}
              </SubText>
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
                  data-test-id="expand-usage-totals"
                  size="sm"
                  onClick={() => setState({...state, expanded: !state.expanded})}
                  icon={<IconChevron direction={state.expanded ? 'up' : 'down'} />}
                  aria-label={t('Expand usage totals')}
                />
              )}
            </AcceptedSummary>
          </BaseRow>
          <PlanUseBarContainer>
            <PlanUseBarGroup style={{width: `${reservedMaxWidth}%`}}>
              {prepaidPercentUsed >= 1 && (
                <PlanUseBar
                  style={{
                    width: `${prepaidPercentUsed}%`,
                    backgroundColor: COLORS.reserved,
                  }}
                />
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
              <LegendContainer>
                <LegendDot style={{backgroundColor: COLORS.reserved}} />

                {isDisplayingSpend ? (
                  prepaidPrice === 0 ? (
                    // No reserved price, included in plan
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
                    <div>
                      <LegendTitle>{t('Included in Subscription')}</LegendTitle>
                      <LegendPrice>
                        {formatPercentage(prepaidPercentUsed / 100)} of{' '}
                        {prepaidPrice === 0
                          ? reserved
                          : formatCurrency(roundUpToNearestDollar(prepaidPrice))}
                      </LegendPrice>
                    </div>
                  )
                ) : (
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
                )}
              </LegendContainer>
              {showOnDemand && (
                <LegendContainer>
                  <LegendDot style={{backgroundColor: COLORS.ondemand}} />
                  {isDisplayingSpend ? (
                    <div>
                      <LegendTitle>
                        {subscription.planTier === PlanTier.AM3
                          ? t('Pay-as-you-go')
                          : t('On-Demand')}
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
                        {subscription.planTier === PlanTier.AM3
                          ? t('Pay-as-you-go')
                          : t('On-Demand')}
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
                      {subscription.planTier === PlanTier.AM3
                        ? t('Pay-as-you-go')
                        : t('On-Demand')}
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
            totals={totals}
            subscription={subscription}
          />

          {showEventBreakdown &&
            Object.entries(eventTotals).map(([key, eventTotal]) => {
              return (
                <UsageTotalsTable
                  isEventBreakdown
                  key={key}
                  category={key}
                  totals={eventTotal}
                  subscription={subscription}
                />
              );
            })}
        </Fragment>
      )}
    </SubscriptionCard>
  );
}

export default UsageTotals;

const SubscriptionCard = styled(Card)`
  padding: ${space(2)};
`;

const CardBody = styled('div')`
  display: grid;
  align-items: center;
  gap: ${space(2)};
`;

const UsageSummaryTitle = styled('h4')`
  font-size: ${p => p.theme.fontSizeLarge};
  margin-bottom: 0px;
  font-weight: 400;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    font-size: ${p => p.theme.fontSizeExtraLarge};
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
  color: ${p => p.theme.chartLabel};
  font-size: ${p => p.theme.fontSizeMedium};
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

const LegendTitle = styled('div')`
  font-weight: 700;
  font-size: ${p => p.theme.fontSizeSmall};
`;

const LegendPrice = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
`;

const LegendPriceSubText = styled(LegendPrice)`
  color: ${p => p.theme.subText};
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
