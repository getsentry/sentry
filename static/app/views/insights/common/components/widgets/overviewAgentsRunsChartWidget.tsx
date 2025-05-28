import {t} from 'sentry/locale';
import {getAgentRunsFilter} from 'sentry/views/insights/agentMonitoring/utils/query';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import {BaseTrafficWidget} from 'sentry/views/insights/pages/platform/shared/baseTrafficWidget';

export default function OverviewAgentsRunsChartWidget(props: LoadableChartWidgetProps) {
  return (
    <BaseTrafficWidget
      id="overviewAgentsRunsChartWidget"
      title={t('Traffic')}
      trafficSeriesName={t('Runs')}
      baseQuery={getAgentRunsFilter()}
      {...props}
    />
  );
}
