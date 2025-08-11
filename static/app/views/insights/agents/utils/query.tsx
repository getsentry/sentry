// AI Runs - equivalent to OTEL Invoke Agent span
// https://github.com/open-telemetry/semantic-conventions/blob/main/docs/gen-ai/gen-ai-agent-spans.md#invoke-agent-span
const AI_RUN_OPS = [
  'ai.run.generateText',
  'ai.run.generateObject',
  'gen_ai.invoke_agent',
  'ai.pipeline.generate_text',
  'ai.pipeline.generate_object',
  'ai.pipeline.stream_text',
  'ai.pipeline.stream_object',
];

// AI Generations - equivalent to OTEL Inference span
// https://github.com/open-telemetry/semantic-conventions/blob/main/docs/gen-ai/gen-ai-spans.md#inference
export const AI_GENERATION_OPS = [
  'ai.run.doGenerate',
  'gen_ai.chat',
  'gen_ai.generate_content',
  'gen_ai.generate_text',
  'gen_ai.generate_object',
  'gen_ai.stream_text',
  'gen_ai.stream_object',
  'gen_ai.embed', // AI SDK
  'gen_ai.embed_many', // AI SDK
  'gen_ai.embeddings', // Python OpenAI
  'gen_ai.text_completion',
  'gen_ai.responses',
];

const NON_GENERATION_OPS = [...AI_RUN_OPS, 'gen_ai.execute_tool', 'gen_ai.handoff'];

export function getIsAiSpan({op = 'default'}: {op?: string}) {
  return op.startsWith('gen_ai.');
}

export function getIsAiRunSpan({op = 'default'}: {op?: string}) {
  return AI_RUN_OPS.includes(op);
}

// All of the gen_ai.* spans that are not agent invocations, handoffs, or tool calls are considered generation spans
export function getIsAiGenerationSpan({op = 'default'}: {op?: string}) {
  return op.startsWith('gen_ai.') && !NON_GENERATION_OPS.includes(op);
}

function joinValues(values: string[]) {
  return values.map(value => `"${value}"`).join(',');
}

export const getAgentRunsFilter = ({negated = false}: {negated?: boolean} = {}) => {
  return `${negated ? '!' : ''}span.op:[${joinValues(AI_RUN_OPS)}]`;
};

// All of the gen_ai.* spans that are not agent invocations, handoffs, or tool calls are considered generation spans
export const getAIGenerationsFilter = () => {
  return `span.op:gen_ai.* !span.op:[${joinValues(NON_GENERATION_OPS)}]`;
};

export const getAITracesFilter = () => {
  return `span.op:gen_ai.*`;
};
