import {parseAsArrayOf, parseAsString, useQueryState} from 'nuqs';

import {escapeDoubleQuotes} from 'sentry/utils';
import {SpanFields} from 'sentry/views/insights/types';

export function useToolFilter() {
  const [toolFilters] = useQueryState(
    'tool',
    parseAsArrayOf(parseAsString).withDefault([])
  );

  let toolQuery = '';
  if (toolFilters.length > 0) {
    const values = toolFilters.map(v => `"${escapeDoubleQuotes(v)}"`).join(', ');
    toolQuery = `${SpanFields.GEN_AI_TOOL_NAME}:[${values}]`;
  }

  return {toolQuery};
}
