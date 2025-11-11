import {t} from 'sentry/locale';
import GroupedErrorRateWidget from 'sentry/views/insights/pages/mcp/components/groupedErrorRateWidget';
import {MCPReferrer} from 'sentry/views/insights/pages/mcp/utils/referrer';
import {SpanFields} from 'sentry/views/insights/types';

export default function McpResourceErrorRateWidget() {
  return (
    <GroupedErrorRateWidget
      groupBy={SpanFields.MCP_RESOURCE_URI}
      referrer={MCPReferrer.MCP_RESOURCE_ERROR_RATE_WIDGET}
      query={`span.op:mcp.server has:${SpanFields.MCP_RESOURCE_URI}`}
      title={t('Most Failing Resources')}
    />
  );
}
