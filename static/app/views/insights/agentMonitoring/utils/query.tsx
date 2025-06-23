// These are the span op we are currently ingesting.

import type {EAPSpanProperty} from 'sentry/views/insights/types';

// AI Runs - equivalent to OTEL Invoke Agent span
// https://github.com/open-telemetry/semantic-conventions/blob/main/docs/gen-ai/gen-ai-agent-spans.md#invoke-agent-span
export const AI_RUN_OPS = [
  'ai.run.generateText',
  'ai.run.generateObject',
  'gen_ai.invoke_agent',
  'ai.pipeline.generate_text',
];
export const AI_RUN_DESCRIPTIONS = ['ai.generateText', 'generateText'];

// AI Generations - equivalent to OTEL Inference span
// https://github.com/open-telemetry/semantic-conventions/blob/main/docs/gen-ai/gen-ai-spans.md#inference
export const AI_GENERATION_OPS = [
  'ai.run.doGenerate',
  'gen_ai.chat',
  'gen_ai.generate_content',
  'gen_ai.generate_text',
  'gen_ai.generate_object',
  'get_ai.stream_text',
  'gen_ai.text_completion',
];
export const AI_GENERATION_DESCRIPTIONS = [
  'ai.generateText.doGenerate',
  'generateText.doGenerate',
];

// AI Tool Calls - equivalent to OTEL Execute tool span
// https://github.com/open-telemetry/semantic-conventions/blob/main/docs/gen-ai/gen-ai-spans.md#execute-tool-span
export const AI_TOOL_CALL_OPS = ['gen_ai.execute_tool'];
export const AI_TOOL_CALL_DESCRIPTIONS = ['ai.toolCall'];

const AI_OPS = [...AI_RUN_OPS, ...AI_GENERATION_OPS, ...AI_TOOL_CALL_OPS];
const AI_DESCRIPTIONS = [
  ...AI_RUN_DESCRIPTIONS,
  ...AI_GENERATION_DESCRIPTIONS,
  ...AI_TOOL_CALL_DESCRIPTIONS,
];

export const AI_MODEL_ID_ATTRIBUTE = 'gen_ai.request.model' as EAPSpanProperty;
export const AI_TOOL_NAME_ATTRIBUTE = 'gen_ai.tool.name' as EAPSpanProperty;
export const AI_AGENT_NAME_ATTRIBUTE = 'gen_ai.agent.name' as EAPSpanProperty;
export const AI_TOTAL_TOKENS_ATTRIBUTE = 'gen_ai.usage.total_tokens' as EAPSpanProperty;

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
  ['gen_ai.tool.input', ['ai.toolCall.args']],
  ['gen_ai.tool.output', ['ai.toolCall.result']],
  ['gen_ai.request.messages', ['ai.prompt.messages']],
  ['gen_ai.response.tool_calls', ['ai.response.toolCalls']],
  ['gen_ai.response.text', ['ai.response.text']],
  ['gen_ai.tool.name', ['ai.toolCall.name']],
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

export const getAgentRunsFilter = () => {
  return `(span.op:[${AI_RUN_OPS.join(',')}] or span.description:[${AI_RUN_DESCRIPTIONS.join(',')}])`;
};

export const getAIGenerationsFilter = () => {
  return `(span.op:[${AI_GENERATION_OPS.join(',')}] or span.description:[${AI_GENERATION_DESCRIPTIONS.join(',')}])`;
};

export const getAIToolCallsFilter = () => {
  return `(span.op:[${AI_TOOL_CALL_OPS.join(',')}] or span.description:[${AI_TOOL_CALL_DESCRIPTIONS.join(',')}])`;
};

export const getAITracesFilter = () => {
  return `has:${AI_MODEL_ID_ATTRIBUTE}`;
};
