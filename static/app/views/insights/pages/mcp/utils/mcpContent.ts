import {
  SEARCH_GEN_AI__PROMPT__VARIABLE__KEY,
  SEARCH_MCP__REQUEST__ARGUMENT__KEY,
} from '@sentry/conventions/attributes/search';

type Attributes = Record<string, string | number | boolean> | undefined;

const ARGUMENT_PREFIX = SEARCH_MCP__REQUEST__ARGUMENT__KEY.replace('<key>', '');
const PROMPT_VARIABLE_PREFIX = SEARCH_GEN_AI__PROMPT__VARIABLE__KEY.replace('<key>', '');
const TOOL_RESULT_PREFIX = 'mcp.tool.result.';

/** Read captured arguments, preferring case-preserving prompt variables. */
export function getMCPRequestArguments(attributes: Attributes) {
  const entries = Object.entries(attributes ?? {});
  const variables = entries
    .filter(([key]) => key.startsWith(PROMPT_VARIABLE_PREFIX))
    .map(([key, value]) => [key.slice(PROMPT_VARIABLE_PREFIX.length), value] as const);
  const variableNames = new Set(variables.map(([key]) => key.toLowerCase()));
  const legacy = entries
    .filter(([key]) => key.startsWith(ARGUMENT_PREFIX))
    .map(([key, value]) => [key.slice(ARGUMENT_PREFIX.length), value] as const)
    .filter(([key]) => !variableNames.has(key));

  return variables.length || legacy.length
    ? Object.fromEntries([...legacy, ...variables])
    : undefined;
}

/** Return captured legacy fields without reconstructing a complete tool result. */
export function getLegacyMCPToolResult(attributes: Attributes) {
  const entries = Object.entries(attributes ?? {})
    .filter(([key]) => key.startsWith(TOOL_RESULT_PREFIX))
    .map(([key, value]) => [key.slice(TOOL_RESULT_PREFIX.length), value] as const);

  // Counts, types and error status are captured even when recording output is off.
  const hasContent = entries.some(
    ([key]) => !/^(?:\d+\.)?(?:content_count|content_type|is_error)$/.test(key)
  );

  // Preserve the original indices and partial fields; they cannot reconstruct a full result.
  return hasContent ? Object.fromEntries(entries) : undefined;
}
