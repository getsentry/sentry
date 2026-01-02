import {t} from 'sentry/locale';
import GroupedTrafficWidget from 'sentry/views/insights/pages/mcp/components/groupedTrafficWidget';
import {MCPReferrer} from 'sentry/views/insights/pages/mcp/utils/referrer';
import {SpanFields} from 'sentry/views/insights/types';

export default function McpPromptTrafficWidget() {
  return (
    <GroupedTrafficWidget
      groupBy={SpanFields.MCP_PROMPT_NAME}
      referrer={MCPReferrer.MCP_PROMPT_TRAFFIC_WIDGET}
      query={`span.op:mcp.server has:${SpanFields.MCP_PROMPT_NAME}`}
      title={t('Most Used Prompts')}
    />
  );
}
