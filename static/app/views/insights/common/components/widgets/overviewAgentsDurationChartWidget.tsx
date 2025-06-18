import {t} from 'sentry/locale';
import {getAgentRunsFilter} from 'sentry/views/insights/agentMonitoring/utils/query';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import BaseLatencyWidget from 'sentry/views/insights/pages/platform/shared/baseLatencyWidget';

export default function OverviewAgentsDurationChartWidget(
  props: LoadableChartWidgetProps
) {
  return (
    <BaseLatencyWidget
      id="overviewAgentsDurationChartWidget"
      title={t('Duration')}
      baseQuery={getAgentRunsFilter()}
      {...props}
    />
  );
}
