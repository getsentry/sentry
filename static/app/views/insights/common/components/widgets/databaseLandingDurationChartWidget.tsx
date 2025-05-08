import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import {useDatabaseLandingDurationQuery} from 'sentry/views/insights/common/components/widgets/hooks/useDatabaseLandingDurationQuery';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import {getDurationChartTitle} from 'sentry/views/insights/common/views/spans/types';
import {DEFAULT_DURATION_AGGREGATE} from 'sentry/views/insights/database/settings';

export default function DatabaseLandingDurationChartWidget(
  props: LoadableChartWidgetProps
) {
  const {isPending, data, error} = useDatabaseLandingDurationQuery();

  return (
    <InsightsLineChartWidget
      {...props}
      id="databaseLandingDurationChartWidget"
      title={getDurationChartTitle('db')}
      series={[data[`${DEFAULT_DURATION_AGGREGATE}(span.self_time)`]]}
      isLoading={isPending}
      error={error}
    />
  );
}
