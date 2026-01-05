import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import color from 'color';

import {Tooltip} from 'sentry/components/core/tooltip';
import {IconInfo} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';

import {PlanTier, type Subscription} from 'getsentry/types';
import {displayBudgetName, hasNewBillingUI} from 'getsentry/utils/billing';
import formatCurrency from 'getsentry/utils/formatCurrency';
import {roundUpToNearestDollar} from 'getsentry/utils/roundUpToNearestDollar';
import {
  getTotalBudget,
  hasOnDemandBudgetsFeature,
  parseOnDemandBudgetsFromSubscription,
} from 'getsentry/views/onDemandBudgets/utils';
import {
  calculateTotalSpend,
  shouldSeeSpendVisibility,
} from 'getsentry/views/subscriptionPage/utils';

interface UsageCardProps {
  organization: Organization;
  subscription: Subscription;
}

export function UsageCard({subscription, organization}: UsageCardProps) {
  const theme = useTheme();
  const intervalPrice = subscription.customPrice
    ? subscription.customPrice
    : subscription.planDetails?.price;

  const COLORS = {
    prepaid: theme.chart.getColorPalette(5)[0],
    ondemand: theme.chart.getColorPalette(5)[1],
  } as const;

  if (
    !intervalPrice ||
    !shouldSeeSpendVisibility(subscription) ||
    hasNewBillingUI(organization) // TODO(subscriptions-v3): remove this, this is temporary until the real header cards for V3 are implemented
  ) {
    return null;
  }

  const hasOnDemand =
    hasOnDemandBudgetsFeature(organization, subscription) ||
    subscription.planTier === PlanTier.AM3;
  const showOnDemand = hasOnDemand && subscription.onDemandMaxSpend !== 0;
  const onDemandBudgets = parseOnDemandBudgetsFromSubscription(subscription);
  const onDemandTotalBudget =
    'sharedMaxBudget' in onDemandBudgets
      ? onDemandBudgets.sharedMaxBudget
      : getTotalBudget(onDemandBudgets);

  const {
    prepaidTotalSpent,
    prepaidReservedBudgetPrice,
    onDemandTotalSpent,
    prepaidTotalPrice,
  } = calculateTotalSpend(subscription);
  const priceWithoutReservedBudgets = prepaidTotalPrice - prepaidReservedBudgetPrice;
  const spendWithoutReservedBudgets = prepaidTotalSpent - prepaidReservedBudgetPrice;
  const showPrepaid = prepaidTotalPrice > 0;
  const showIncludedInSubscription = priceWithoutReservedBudgets > 0;

  // No reserved spend beyond the base subscription and no on-demand budgets
  if (!showPrepaid && !showOnDemand) {
    return null;
  }

  // Round the usage width to avoid half pixel artifacts
  // Prevent more than 100% width
  const prepaidPercentUsed = Math.max(
    0,
    Math.round(
      Math.min((spendWithoutReservedBudgets / priceWithoutReservedBudgets) * 100, 100)
    )
  );
  const prepaidPercentUnused = 100 - prepaidPercentUsed;
  const onDemandPercentUsed = Math.round(
    Math.min((onDemandTotalSpent / onDemandTotalBudget) * 100, 100)
  );
  const onDemandPercentUnused = 100 - onDemandPercentUsed;

  // Calculate the width of the prepaid bar relative to on demand
  let prepaidMaxWidth = showOnDemand && showPrepaid ? 50 : showPrepaid ? 100 : 0;
  if (showOnDemand && showPrepaid && prepaidTotalSpent && onDemandTotalBudget) {
    prepaidMaxWidth = Math.round(
      (priceWithoutReservedBudgets /
        (priceWithoutReservedBudgets + onDemandTotalBudget)) *
        100
    );
  }

  return (
    <PlanUseBody data-test-id="usage-card">
      <UsageSummary
        style={{gridTemplateColumns: `repeat(${showOnDemand ? 3 : 2}, auto)`}}
      >
        {showIncludedInSubscription && (
          <SummaryWrapper>
            <SummaryTitleWrapper>
              <SummaryTitle>{t('Included In Subscription')}</SummaryTitle>
              <Tooltip
                title={t('Your reserved purchase above the base plan')}
                skipWrapper
              >
                <IconInfo size="xs" />
              </Tooltip>
            </SummaryTitleWrapper>
            <SummaryTotal>
              {formatCurrency(roundUpToNearestDollar(priceWithoutReservedBudgets))}/mo
            </SummaryTotal>
          </SummaryWrapper>
        )}
        {showOnDemand && (
          <SummaryWrapper>
            <SummaryTitleWrapper>
              <SummaryTitle>
                {tct('[budgetType] Spent', {
                  budgetType: displayBudgetName(subscription.planDetails, {title: true}),
                })}
              </SummaryTitle>
              <Tooltip
                title={tct('[budgetType] consumed', {
                  budgetType: displayBudgetName(subscription.planDetails, {
                    title: true,
                    withBudget: true,
                  }),
                })}
                skipWrapper
              >
                <IconInfo size="xs" />
              </Tooltip>
            </SummaryTitleWrapper>
            <SummaryTotal>{formatCurrency(onDemandTotalSpent)}</SummaryTotal>
          </SummaryWrapper>
        )}
        <SummaryWrapper data-test-id="current-monthly-spend">
          <SummaryTitleWrapper>
            <SummaryTitle>
              {subscription.billingInterval === 'annual'
                ? t('Additional Monthly Spend')
                : t('Current Monthly Spend')}
            </SummaryTitle>
            <Tooltip title={t('Total spend till date')} skipWrapper>
              <IconInfo size="xs" />
            </Tooltip>
          </SummaryTitleWrapper>
          <SummaryTotal>
            {formatCurrency(
              subscription.billingInterval === 'annual'
                ? onDemandTotalSpent
                : subscription.planDetails.basePrice +
                    prepaidTotalPrice +
                    onDemandTotalSpent
            )}
          </SummaryTotal>
        </SummaryWrapper>
      </UsageSummary>
      <PlanUseBarContainer>
        {showIncludedInSubscription && (
          <PlanUseBarGroup style={{width: `${prepaidMaxWidth}%`}}>
            {prepaidPercentUsed > 1 && (
              <PlanUseBar
                style={{
                  width: `${prepaidPercentUsed}%`,
                  backgroundColor: COLORS.prepaid,
                }}
              />
            )}
            {prepaidPercentUnused > 1 && (
              <PlanUseBar
                style={{
                  width: `${prepaidPercentUnused}%`,
                  backgroundColor: color(COLORS.prepaid).fade(0.5).string(),
                }}
              />
            )}
          </PlanUseBarGroup>
        )}
        {showOnDemand && (
          <PlanUseBarGroup style={{width: `${100 - prepaidMaxWidth}%`}}>
            {onDemandPercentUsed > 1 && (
              <PlanUseBar
                style={{
                  width: `${onDemandPercentUsed}%`,
                  backgroundColor: COLORS.ondemand,
                }}
              />
            )}
            {onDemandPercentUnused > 1 && (
              <PlanUseBar
                style={{
                  width: `${onDemandPercentUnused}%`,
                  backgroundColor: color(COLORS.ondemand).fade(0.5).string(),
                }}
              />
            )}
          </PlanUseBarGroup>
        )}
      </PlanUseBarContainer>
      <LegendPriceWrapper>
        {showIncludedInSubscription && (
          <LegendContainer>
            <LegendDot style={{backgroundColor: COLORS.prepaid}} />
            <div>
              <LegendTitle>{t('Included in Subscription')}</LegendTitle>
              <LegendPrice>
                {formatPercentage(prepaidPercentUsed / 100)} of{' '}
                {formatCurrency(roundUpToNearestDollar(priceWithoutReservedBudgets))}
              </LegendPrice>
            </div>
          </LegendContainer>
        )}
        {showOnDemand && (
          <LegendContainer>
            <LegendDot style={{backgroundColor: COLORS.ondemand}} />
            <div>
              <LegendTitle>
                {displayBudgetName(subscription.planDetails, {title: true})}
              </LegendTitle>
              <LegendPrice>
                {formatCurrency(onDemandTotalSpent)} of{' '}
                {formatCurrency(onDemandTotalBudget)}
              </LegendPrice>
            </div>
          </LegendContainer>
        )}
      </LegendPriceWrapper>
    </PlanUseBody>
  );
}

const UsageSummary = styled('div')`
  display: grid;
  gap: ${space(1.5)};
  align-items: center;
  justify-content: flex-end;
  text-align: right;
`;

const SummaryWrapper = styled('div')`
  ${p => p.theme.overflowEllipsis}
`;

const SummaryTitleWrapper = styled('div')`
  display: flex;
  gap: ${space(0.25)};
  align-items: baseline;
`;

const SummaryTitle = styled('div')`
  ${p => p.theme.overflowEllipsis}
`;

const SummaryTotal = styled('div')`
  font-size: ${p => p.theme.fontSize.lg};
  font-weight: 700;
`;

const PlanUseBody = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.75)};
  padding: 0 ${space(3)} ${space(1.5)} ${space(3)};
  line-height: 1.2;
  color: ${p => p.theme.subText};

  @media (min-width: ${p => p.theme.breakpoints.lg}) {
    padding: ${space(1.5)} ${space(3)} ${space(1.5)} 0;
  }
`;

const PlanUseBarContainer = styled('div')`
  display: flex;
  height: 14px;
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
  font-size: ${p => p.theme.fontSize.sm};
`;

const LegendPrice = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
  font-variant-numeric: tabular-nums;
`;
