// These are the span op we are currently ingesting.

import type {EAPSpanProperty} from 'sentry/views/insights/types';

// AI Runs - equivalent to OTEL Invoke Agent span
// https://github.com/open-telemetry/semantic-conventions/blob/main/docs/gen-ai/gen-ai-agent-spans.md#invoke-agent-span
export const AI_RUN_OPS = [
  'ai.run.generateText',
  'ai.run.generateObject',
  'gen_ai.invoke_agent',
];
export const AI_RUN_DESCRIPTIONS = ['ai.generateText', 'generateText'];

// AI Generations - equivalent to OTEL Inference span
// https://github.com/open-telemetry/semantic-conventions/blob/main/docs/gen-ai/gen-ai-spans.md#inference
export const AI_GENERATION_OPS = [
  'ai.run.doGenerate',
  'gen_ai.chat',
  'gen_ai.generate_content',
  'gen_ai.text_completion',
];
export const AI_GENERATION_DESCRIPTIONS = [
  'ai.generateText.doGenerate',
  'generateText.doGenerate',
];

// AI Tool Calls - equivalent to OTEL Execute tool span
// https://github.com/open-telemetry/semantic-conventions/blob/main/docs/gen-ai/gen-ai-spans.md#execute-tool-span
export const AI_TOOL_CALL_OPS = ['gen_ai.execute_tool', 'ai.toolCall'];

const AI_OPS = [...AI_RUN_OPS, ...AI_GENERATION_OPS, ...AI_TOOL_CALL_OPS];
const AI_DESCRIPTIONS = [...AI_RUN_DESCRIPTIONS, ...AI_GENERATION_DESCRIPTIONS];

export const AI_MODEL_ID_ATTRIBUTE = 'ai.model.id' as EAPSpanProperty;
export const AI_TOOL_NAME_ATTRIBUTE = 'ai.toolCall.name' as EAPSpanProperty;

export const AI_TOKEN_USAGE_ATTRIBUTE_SUM =
  `sum(tags[gen_ai.usage.total_tokens,number])` as EAPSpanProperty;
export const AI_INPUT_TOKENS_ATTRIBUTE_SUM =
  `sum(tags[gen_ai.usage.input_tokens,number])` as EAPSpanProperty;
export const AI_OUTPUT_TOKENS_ATTRIBUTE_SUM =
  `sum(tags[gen_ai.usage.output_tokens,number])` as EAPSpanProperty;

export const legacyAttributeKeys = new Map<string, string[]>([
  ['gen_ai.request.model', ['ai.model.id']],
  ['gen_ai.usage.input_tokens', ['ai.prompt_tokens.used']],
  ['gen_ai.usage.output_tokens', ['ai.completion_tokens.used']],
  ['gen_ai.usage.total_tokens', ['ai.total_tokens.used']],
  ['gen_ai.usage.total_cost', ['ai.total_cost.used']],
]);

export function getIsAiSpan({
  op = 'default',
  description,
}: {
  description?: string;
  op?: string;
}) {
  if (op !== 'default') {
    return AI_OPS.includes(op);
  }
  return AI_DESCRIPTIONS.includes(description ?? '');
}

// TODO: Remove once tool spans have their own op
export function mapMissingSpanOp({
  op = 'default',
  description,
}: {
  description?: string;
  op?: string;
}) {
  if (op !== 'default') {
    return op;
  }

  if (description === 'ai.toolCall') {
    return 'ai.toolCall';
  }

  return op;
}

export function getIsAiSpanLoose({op, description}: {description?: string; op?: string}) {
  if (description?.startsWith('ai') || description?.startsWith('gen_ai')) {
    return true;
  }
  if (op?.startsWith('ai') || op?.startsWith('gen_ai')) {
    return true;
  }
  if (op === 'http.client') {
    return true;
  }
  return false;
}

export const getAgentRunsFilter = () => {
  return `span.op:[${AI_RUN_OPS.join(',')}] or span.description:[${AI_RUN_DESCRIPTIONS.join(',')}]`;
};

export const getAIGenerationsFilter = () => {
  return `span.op:[${AI_GENERATION_OPS.join(',')}] or span.description:[${AI_GENERATION_DESCRIPTIONS.join(',')}]`;
};

export const getAIToolCallsFilter = () => {
  return `span.description:[${AI_TOOL_CALL_OPS.join(',')}]`;
};

export const getAITracesFilter = () => {
  return `has:${AI_MODEL_ID_ATTRIBUTE}`;
};
