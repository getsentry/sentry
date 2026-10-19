import type {TraceItemResponseAttribute} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {getTraceNodeAttribute} from 'sentry/views/insights/pages/agents/utils/aiTraceNodes';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';

const CODE_MODE_TOOLS = new Set([
  'sentry_api_execute',
  'execute_code',
  'codemode',
  'code_mode',
]);

export function isCodeModeNode(
  node: AITraceSpanNode,
  attributes?: TraceItemResponseAttribute[]
) {
  const name =
    getTraceNodeAttribute('gen_ai.tool.name', node, undefined, attributes) ??
    getTraceNodeAttribute('gen_ai.tool.name', node);
  return typeof name === 'string' && CODE_MODE_TOOLS.has(name);
}

export function getCodeModeInput(input: unknown): {
  code: string;
  language: string;
} | null {
  let parsed: unknown = input;
  if (typeof input === 'string') {
    try {
      parsed = JSON.parse(input);
    } catch {
      // Preserve raw source, including incomplete code from failed executions.
      return input.trim() ? {code: input, language: 'javascript'} : null;
    }
  }
  if (typeof parsed === 'string') {
    return parsed.trim() ? {code: parsed, language: 'javascript'} : null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null;
  }
  const args = parsed as Record<string, unknown>;
  const code = args.code ?? args.script;
  if (typeof code !== 'string' || !code.trim()) {
    return null;
  }
  let language = typeof args.language === 'string' ? args.language : 'javascript';
  if (language === 'js') {
    language = 'javascript';
  } else if (language === 'py') {
    language = 'python';
  }
  return {code, language};
}
