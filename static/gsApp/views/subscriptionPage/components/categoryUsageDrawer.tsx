import OptionSelector from 'sentry/components/charts/optionSelector';
import {ChartControls, InlineContainer} from 'sentry/components/charts/styles';
import {Container, Flex} from 'sentry/components/core/layout';
import {DrawerBody, DrawerHeader} from 'sentry/components/globalDrawer/components';
import {t} from 'sentry/locale';
import {DataCategory} from 'sentry/types/core';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {CHART_OPTIONS_DATA_TRANSFORM} from 'sentry/views/organizationStats/usageChart';

import {
  PlanTier,
  type BillingMetricHistory,
  type BillingStats,
  type BillingStatTotal,
  type Subscription,
} from 'getsentry/types';
import {addBillingStatTotals, isAm2Plan} from 'getsentry/utils/billing';
import {
  getChunkCategoryFromDuration,
  getPlanCategoryName,
  isContinuousProfiling,
} from 'getsentry/utils/dataCategory';
import {
  ProductUsageChart,
  selectedTransform,
} from 'getsentry/views/subscriptionPage/reservedUsageChart';
import {EMPTY_STAT_TOTAL} from 'getsentry/views/subscriptionPage/usageTotals';
import UsageTotalsTable from 'getsentry/views/subscriptionPage/usageTotalsTable';

interface CategoryUsageDrawerProps {
  categoryInfo: BillingMetricHistory;
  eventTotals: Record<string, BillingStatTotal>;
  periodEnd: string;
  periodStart: string;
  stats: BillingStats;
  subscription: Subscription;
  totals: BillingStatTotal;
}

function CategoryUsageDrawer({
  categoryInfo,
  stats,
  totals,
  eventTotals,
  subscription,
  periodStart,
  periodEnd,
}: CategoryUsageDrawerProps) {
  const organization = useOrganization();
  const navigate = useNavigate();
  const location = useLocation();
  const transform = selectedTransform(location);
  const {category} = categoryInfo;

  const displayName = getPlanCategoryName({
    plan: subscription.planDetails,
    category: categoryInfo.category,
    title: true,
  });

  const usageStats = {
    [categoryInfo.category]: stats,
  };

  const adjustedTotals = isContinuousProfiling(category)
    ? {
        ...addBillingStatTotals(totals, [
          eventTotals[getChunkCategoryFromDuration(category)] ?? EMPTY_STAT_TOTAL,
          !isAm2Plan(subscription.plan) && category === DataCategory.PROFILE_DURATION
            ? (eventTotals[DataCategory.PROFILES] ?? EMPTY_STAT_TOTAL)
            : EMPTY_STAT_TOTAL,
        ]),
        accepted: categoryInfo.usage,
      }
    : {...totals, accepted: categoryInfo.usage};

  const renderFooter = () => {
    return (
      <ChartControls>
        <InlineContainer>
          <OptionSelector
            title={t('Type')}
            selected={transform}
            options={CHART_OPTIONS_DATA_TRANSFORM}
            onChange={(val: string) =>
              navigate({
                pathname: location.pathname,
                query: {...location.query, transform: val},
              })
            }
          />
        </InlineContainer>
      </ChartControls>
    );
  };

  const showEventBreakdown =
    organization.features.includes('profiling-billing') &&
    subscription.planTier === PlanTier.AM2 &&
    categoryInfo.category === DataCategory.TRANSACTIONS;

  return (
    <Container>
      <DrawerHeader>
        <Flex align="center">{displayName}</Flex>
      </DrawerHeader>
      <DrawerBody>
        <ProductUsageChart
          useDisplayModeTitle={false}
          usageStats={usageStats}
          shouldDisplayBudgetStats={false}
          reservedBudgetCategoryInfo={{}}
          displayMode="usage"
          subscription={subscription}
          category={categoryInfo.category}
          transform={transform}
          usagePeriodStart={periodStart}
          usagePeriodEnd={periodEnd}
          footer={renderFooter()}
        />
        <UsageTotalsTable
          category={categoryInfo.category}
          isEventBreakdown={showEventBreakdown}
          totals={adjustedTotals}
          subscription={subscription}
        />
      </DrawerBody>
    </Container>
  );
}

export default CategoryUsageDrawer;
