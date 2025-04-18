import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import {useDatabaseLandingThroughputQuery} from 'sentry/views/insights/common/components/widgets/hooks/useDatabaseLandingThroughputQuery';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import {getThroughputChartTitle} from 'sentry/views/insights/common/views/spans/types';

export default function DatabaseLandingThroughputChartWidget(
  props: LoadableChartWidgetProps
) {
  const {isPending, data, error} = useDatabaseLandingThroughputQuery();

  return (
    <InsightsLineChartWidget
      {...props}
      id="databaseLandingThroughputChartWidget"
      title={getThroughputChartTitle('db')}
      series={[data['epm()']]}
      isLoading={isPending}
      error={error}
    />
  );
}
