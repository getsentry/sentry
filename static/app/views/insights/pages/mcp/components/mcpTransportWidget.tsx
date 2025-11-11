import {t} from 'sentry/locale';
import GroupedTrafficWidget from 'sentry/views/insights/pages/mcp/components/groupedTrafficWidget';
import {MCPReferrer} from 'sentry/views/insights/pages/mcp/utils/referrer';
import {SpanFields} from 'sentry/views/insights/types';

export default function McpTransportWidget() {
  return (
    <GroupedTrafficWidget
      groupBy={SpanFields.MCP_TRANSPORT}
      referrer={MCPReferrer.MCP_TRANSPORT_WIDGET}
      query={`span.op:mcp.server has:${SpanFields.MCP_TRANSPORT}`}
      title={t('Transport Distribution')}
    />
  );
}
