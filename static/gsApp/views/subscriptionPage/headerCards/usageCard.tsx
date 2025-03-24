import styled from '@emotion/styled';
import color from 'color';

import {Tooltip} from 'sentry/components/tooltip';
import {CHART_PALETTE} from 'sentry/constants/chartPalette';
import {IconInfo} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';

import {PlanTier, type Subscription} from 'getsentry/types';
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

const COLORS = {
  prepaid: CHART_PALETTE[5]![0]!,
  ondemand: CHART_PALETTE[5]![1]!,
} as const;

interface UsageCardProps {
  organization: Organization;
  subscription: Subscription;
}

export function UsageCard({subscription, organization}: UsageCardProps) {
  const intervalPrice = subscription.customPrice
    ? subscription.customPrice
    : subscription.planDetails?.price;

  if (!intervalPrice || !shouldSeeSpendVisibility(subscription)) {
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

  const {prepaidTotalSpent, onDemandTotalSpent, prepaidTotalPrice} =
    calculateTotalSpend(subscription);
  const showPrepaid = prepaidTotalPrice > 0;

  // No reserved spend beyond the base subscription and no on-demand budgets
  if (!showPrepaid && !showOnDemand) {
    return null;
  }

  // Round the usage width to avoid half pixel artifacts
  // Prevent more than 100% width
  const prepaidPercentUsed = Math.max(
    0,
    Math.round(Math.min((prepaidTotalSpent / prepaidTotalPrice) * 100, 100))
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
      (prepaidTotalPrice / (prepaidTotalPrice + onDemandTotalBudget)) * 100
    );
  }

  return (
    <PlanUseBody data-test-id="usage-card">
      <UsageSummary
        style={{gridTemplateColumns: `repeat(${showOnDemand ? 3 : 2}, auto)`}}
      >
        {showPrepaid && (
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
              {formatCurrency(roundUpToNearestDollar(prepaidTotalPrice))}/mo
            </SummaryTotal>
          </SummaryWrapper>
        )}
        {showOnDemand && (
          <SummaryWrapper>
            <SummaryTitleWrapper>
              <SummaryTitle>
                {subscription.planTier === PlanTier.AM3
                  ? t('Pay-as-you-go Spent')
                  : t('On-Demand Spent')}
              </SummaryTitle>
              <Tooltip
                title={
                  subscription.planTier === PlanTier.AM3
                    ? t('Pay-as-you-go budget consumed')
                    : t('On-Demand budget consumed')
                }
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
        {showPrepaid && (
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
        {showPrepaid && (
          <LegendContainer>
            <LegendDot style={{backgroundColor: COLORS.prepaid}} />
            <div>
              <LegendTitle>{t('Included in Subscription')}</LegendTitle>
              <LegendPrice>
                {formatPercentage(prepaidPercentUsed / 100)} of{' '}
                {formatCurrency(roundUpToNearestDollar(prepaidTotalPrice))}
              </LegendPrice>
            </div>
          </LegendContainer>
        )}
        {showOnDemand && (
          <LegendContainer>
            <LegendDot style={{backgroundColor: COLORS.ondemand}} />
            <div>
              <LegendTitle>
                {subscription.planTier === PlanTier.AM3
                  ? t('Pay-as-you-go')
                  : t('On-Demand')}
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
  font-size: ${p => p.theme.fontSizeLarge};
  font-weight: 700;
`;

const PlanUseBody = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.75)};
  padding: 0 ${space(3)} ${space(1.5)} ${space(3)};
  line-height: 1.2;
  color: ${p => p.theme.subText};

  @media (min-width: ${p => p.theme.breakpoints.large}) {
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
  font-size: ${p => p.theme.fontSizeSmall};
`;

const LegendPrice = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  font-variant-numeric: tabular-nums;
`;
