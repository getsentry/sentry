import {t} from 'sentry/locale';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import {useCombinedQuery} from 'sentry/views/insights/pages/agents/hooks/useCombinedQuery';
import {MCPReferrer} from 'sentry/views/insights/pages/mcp/utils/referrer';
import {BaseTrafficWidget} from 'sentry/views/insights/pages/platform/shared/baseTrafficWidget';

export default function McpTrafficWidget(props: LoadableChartWidgetProps) {
  const query = useCombinedQuery('span.op:mcp.server');
  return (
    <BaseTrafficWidget
      id="mcpTrafficWidget"
      title={t('Traffic')}
      trafficSeriesName={t('Requests')}
      query={query}
      referrer={MCPReferrer.MCP_TRAFFIC_WIDGET}
      {...props}
    />
  );
}
