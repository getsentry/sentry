import {t} from 'sentry/locale';
import GroupedDurationWidget from 'sentry/views/insights/pages/mcp/components/groupedDurationWidget';
import {MCPReferrer} from 'sentry/views/insights/pages/mcp/utils/referrer';
import {SpanFields} from 'sentry/views/insights/types';

export default function McpResourceDurationWidget() {
  return (
    <GroupedDurationWidget
      groupBy={SpanFields.MCP_RESOURCE_URI}
      referrer={MCPReferrer.MCP_RESOURCE_DURATION_WIDGET}
      query={`span.op:mcp.server has:${SpanFields.MCP_RESOURCE_URI}`}
      title={t('Slowest Resources')}
    />
  );
}
