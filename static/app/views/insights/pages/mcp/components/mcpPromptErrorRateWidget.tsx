import {t} from 'sentry/locale';
import GroupedErrorRateWidget from 'sentry/views/insights/pages/mcp/components/groupedErrorRateWidget';
import {MCPReferrer} from 'sentry/views/insights/pages/mcp/utils/referrer';
import {SpanFields} from 'sentry/views/insights/types';

export default function McpPromptErrorRateWidget() {
  return (
    <GroupedErrorRateWidget
      groupBy={SpanFields.MCP_PROMPT_NAME}
      referrer={MCPReferrer.MCP_PROMPT_ERROR_RATE_WIDGET}
      query={`span.op:mcp.server has:${SpanFields.MCP_PROMPT_NAME}`}
      title={t('Most Failing Prompts')}
    />
  );
}
