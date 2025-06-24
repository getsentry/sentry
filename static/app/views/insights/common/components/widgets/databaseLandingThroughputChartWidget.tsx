import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import {useDatabaseLandingChartFilter} from 'sentry/views/insights/common/components/widgets/hooks/useDatabaseLandingChartFilter';
import {useDatabaseLandingThroughputQuery} from 'sentry/views/insights/common/components/widgets/hooks/useDatabaseLandingThroughputQuery';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import {getThroughputChartTitle} from 'sentry/views/insights/common/views/spans/types';
import {Referrer} from 'sentry/views/insights/database/referrers';
import {FIELD_ALIASES} from 'sentry/views/insights/database/settings';

export default function DatabaseLandingThroughputChartWidget(
  props: LoadableChartWidgetProps
) {
  const {search, enabled} = useDatabaseLandingChartFilter();
  const referrer = Referrer.LANDING_THROUGHPUT_CHART;
  const {isPending, data, error} = useDatabaseLandingThroughputQuery({
    search,
    enabled,
  });

  return (
    <InsightsLineChartWidget
      {...props}
      aliases={FIELD_ALIASES}
      queryInfo={{search, referrer}}
      id="databaseLandingThroughputChartWidget"
      title={getThroughputChartTitle('db')}
      series={[data['epm()']]}
      isLoading={isPending}
      error={error}
    />
  );
}
