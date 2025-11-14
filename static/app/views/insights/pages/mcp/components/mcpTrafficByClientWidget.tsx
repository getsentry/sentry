import {t} from 'sentry/locale';
import GroupedTrafficWidget from 'sentry/views/insights/pages/mcp/components/groupedTrafficWidget';
import {MCPReferrer} from 'sentry/views/insights/pages/mcp/utils/referrer';
import {SpanFields} from 'sentry/views/insights/types';

export default function McpTrafficByClientWidget() {
  return (
    <GroupedTrafficWidget
      groupBy={SpanFields.MCP_CLIENT_NAME}
      referrer={MCPReferrer.MCP_TRAFFIC_BY_CLIENT_WIDGET}
      query="span.op:mcp.server"
      title={t('Traffic by Client')}
    />
  );
}
