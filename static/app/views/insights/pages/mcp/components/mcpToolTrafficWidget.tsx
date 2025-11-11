import {t} from 'sentry/locale';
import GroupedTrafficWidget from 'sentry/views/insights/pages/mcp/components/groupedTrafficWidget';
import {MCPReferrer} from 'sentry/views/insights/pages/mcp/utils/referrer';
import {SpanFields} from 'sentry/views/insights/types';

export default function McpToolTrafficWidget() {
  return (
    <GroupedTrafficWidget
      groupBy={SpanFields.MCP_TOOL_NAME}
      referrer={MCPReferrer.MCP_TOOL_TRAFFIC_WIDGET}
      query={`span.op:mcp.server has:${SpanFields.MCP_TOOL_NAME}`}
      title={t('Most Used Tools')}
    />
  );
}
