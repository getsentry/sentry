import {t} from 'sentry/locale';
import GroupedDurationWidget from 'sentry/views/insights/pages/mcp/components/groupedDurationWidget';
import {MCPReferrer} from 'sentry/views/insights/pages/mcp/utils/referrer';
import {SpanFields} from 'sentry/views/insights/types';

export default function McpToolDurationWidget() {
  return (
    <GroupedDurationWidget
      groupBy={SpanFields.MCP_TOOL_NAME}
      referrer={MCPReferrer.MCP_TOOL_DURATION_WIDGET}
      query={`span.op:mcp.server has:${SpanFields.MCP_TOOL_NAME}`}
      title={t('Slowest Tools')}
    />
  );
}
