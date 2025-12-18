import {Container, Flex} from '@sentry/scraps/layout';

import OptionSelector from 'sentry/components/charts/optionSelector';
import {ChartControls, InlineContainer} from 'sentry/components/charts/styles';
import {t} from 'sentry/locale';
import {DataCategory} from 'sentry/types/core';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {CHART_OPTIONS_DATA_TRANSFORM} from 'sentry/views/organizationStats/usageChart';

import {PlanTier} from 'getsentry/types';
import {addBillingStatTotals, checkIsAddOn, isAm2Plan} from 'getsentry/utils/billing';
import {
  getCategoryInfoFromPlural,
  getChunkCategoryFromDuration,
  isContinuousProfiling,
} from 'getsentry/utils/dataCategory';
import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';
import {
  ProductUsageChart,
  selectedTransform,
} from 'getsentry/views/subscriptionPage/reservedUsageChart';
import type {BreakdownPanelProps} from 'getsentry/views/subscriptionPage/usageOverview/types';
import {EMPTY_STAT_TOTAL} from 'getsentry/views/subscriptionPage/usageTotals';
import UsageTotalsTable from 'getsentry/views/subscriptionPage/usageTotalsTable';

function UsageCharts({
  selectedProduct,
  usageData,
  subscription,
  organization,
}: BreakdownPanelProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const transform = selectedTransform(location);
  if (checkIsAddOn(selectedProduct)) {
    return null;
  }

  const category = selectedProduct as DataCategory;
  // we do not normalize metric history here because if it is isn't present
  // there shouldn't be any usage to show in charts anyway
  const metricHistory = subscription.categories[category];
  const categoryInfo = getCategoryInfoFromPlural(category);

  if (!metricHistory || !categoryInfo) {
    return null;
  }

  const {tallyType} = categoryInfo;
  if (tallyType === 'seat') {
    return null;
  }

  const {usage: billedUsage} = metricHistory;
  const stats = usageData.stats[category] ?? [];
  const eventTotals = usageData.eventTotals?.[category] ?? {};
  const totals = usageData.totals[category] ?? EMPTY_STAT_TOTAL;
  const usageStats = {
    [category]: stats,
  };

  const adjustedTotals = isContinuousProfiling(category)
    ? {
        ...addBillingStatTotals(totals, [
          eventTotals[getChunkCategoryFromDuration(category)] ?? EMPTY_STAT_TOTAL,
          !isAm2Plan(subscription.plan) &&
          selectedProduct === DataCategory.PROFILE_DURATION
            ? (eventTotals[DataCategory.PROFILES] ?? EMPTY_STAT_TOTAL)
            : EMPTY_STAT_TOTAL,
        ]),
        accepted: billedUsage,
      }
    : {...totals, accepted: billedUsage};

  const showEventBreakdown =
    organization.features.includes('profiling-billing') &&
    subscription.planTier === PlanTier.AM2 &&
    category === DataCategory.TRANSACTIONS;

  const renderFooter = () => {
    return (
      <ChartControls>
        <InlineContainer>
          <OptionSelector
            title={t('Type')}
            selected={transform}
            options={CHART_OPTIONS_DATA_TRANSFORM}
            onChange={(val: string) => {
              trackGetsentryAnalytics(
                'subscription_page.usage_overview.transform_changed',
                {
                  organization,
                  subscription,
                  transform: val,
                }
              );
              navigate({
                pathname: location.pathname,
                query: {...location.query, transform: val},
              });
            }}
          />
        </InlineContainer>
      </ChartControls>
    );
  };

  return (
    <Container padding="xl">
      <ProductUsageChart
        useDisplayModeTitle={false}
        usageStats={usageStats}
        shouldDisplayBudgetStats={false}
        reservedBudgetCategoryInfo={{}}
        displayMode="usage"
        subscription={subscription}
        category={category}
        transform={transform}
        usagePeriodStart={usageData.periodStart}
        usagePeriodEnd={usageData.periodEnd}
        footer={renderFooter()}
      />
      <Flex direction="column" gap="xl">
        <UsageTotalsTable
          category={category}
          subscription={subscription}
          totals={adjustedTotals}
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
      </Flex>
    </Container>
  );
}
export default UsageCharts;
