import {z} from 'zod';

import type {TraceItemResponseAttribute} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {getTraceNodeAttribute} from 'sentry/views/insights/pages/agents/utils/aiTraceNodes';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';

const CODE_MODE_TOOLS = new Set([
  'sentry_api_execute',
  'execute_code',
  'codemode',
  'code_mode',
]);

const LANGUAGE_ALIASES = new Map([
  ['js', 'javascript'],
  ['py', 'python'],
]);

const codeModeInputSchema = z
  .union([
    z.string().transform(code => ({code})),
    z
      .object({
        code: z.unknown().optional(),
        script: z.unknown().optional(),
        language: z.unknown().optional(),
      })
      .transform(({code, script, language}) => ({code: code ?? script, language})),
  ])
  .pipe(
    z.object({
      code: z.string().refine(code => code.trim().length > 0),
      // No default: assuming JavaScript would run the JS formatter on other
      // languages, e.g. flatten Python indentation.
      language: z
        .string()
        .optional()
        .catch(undefined)
        .transform(language =>
          language === undefined
            ? undefined
            : (LANGUAGE_ALIASES.get(language) ?? language)
        ),
    })
  );

type CodeModeInput = z.infer<typeof codeModeInputSchema>;

export function isCodeModeNode(
  node: AITraceSpanNode,
  attributes?: TraceItemResponseAttribute[]
) {
  const name =
    getTraceNodeAttribute('gen_ai.tool.name', node, undefined, attributes) ??
    getTraceNodeAttribute('gen_ai.tool.name', node);
  return typeof name === 'string' && CODE_MODE_TOOLS.has(name);
}

export function getCodeModeInput(input: unknown): CodeModeInput | null {
  let parsed: unknown = input;
  if (typeof input === 'string') {
    try {
      parsed = JSON.parse(input);
    } catch {
      parsed = input;
    }
  }
  const result = codeModeInputSchema.safeParse(parsed);
  return result.success ? result.data : null;
}
