import {t} from 'sentry/locale';
import GroupedTrafficWidget from 'sentry/views/insights/pages/mcp/components/groupedTrafficWidget';
import {MCPReferrer} from 'sentry/views/insights/pages/mcp/utils/referrer';
import {SpanFields} from 'sentry/views/insights/types';

export default function McpResourceTrafficWidget() {
  return (
    <GroupedTrafficWidget
      groupBy={SpanFields.MCP_RESOURCE_URI}
      referrer={MCPReferrer.MCP_RESOURCE_TRAFFIC_WIDGET}
      query={`span.op:mcp.server has:${SpanFields.MCP_RESOURCE_URI}`}
      title={t('Most Used Resources')}
    />
  );
}
