import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import {useDatabaseLandingChartFilter} from 'sentry/views/insights/common/components/widgets/hooks/useDatabaseLandingChartFilter';
import {useDatabaseLandingDurationQuery} from 'sentry/views/insights/common/components/widgets/hooks/useDatabaseLandingDurationQuery';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import {getDurationChartTitle} from 'sentry/views/insights/common/views/spans/types';
import {Referrer} from 'sentry/views/insights/database/referrers';

export default function DatabaseLandingDurationChartWidget(
  props: LoadableChartWidgetProps
) {
  const {search, enabled} = useDatabaseLandingChartFilter();
  const referrer = Referrer.LANDING_DURATION_CHART;
  const {isPending, data, error} = useDatabaseLandingDurationQuery({
    search,
    enabled,
  });

  return (
    <InsightsLineChartWidget
      {...props}
      queryInfo={{search, referrer}}
      id="databaseLandingDurationChartWidget"
      title={getDurationChartTitle('db')}
      timeSeries={data?.timeSeries}
      isLoading={isPending}
      error={error}
    />
  );
}
