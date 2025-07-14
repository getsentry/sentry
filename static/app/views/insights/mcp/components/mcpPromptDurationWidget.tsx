import {t} from 'sentry/locale';
import GroupedDurationWidget from 'sentry/views/insights/mcp/components/groupedDurationWidget';
import {MCPReferrer} from 'sentry/views/insights/mcp/utils/referrer';
import {SpanFields} from 'sentry/views/insights/types';

export default function McpPromptDurationWidget() {
  return (
    <GroupedDurationWidget
      groupBy={SpanFields.MCP_PROMPT_NAME}
      referrer={MCPReferrer.MCP_PROMPT_TRAFFIC_WIDGET}
      query={`span.op:mcp.server has:${SpanFields.MCP_PROMPT_NAME}`}
      title={t('Slowest Prompts')}
    />
  );
}
