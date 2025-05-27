// These are the span op we are currently ingesting.

import type {EAPSpanProperty} from 'sentry/views/insights/types';

// They will probably change and maybe it will be enough to inline them in the widgets.
const AI_PIPELINE_OPS = ['ai.pipeline.generateText', 'ai.pipeline.generateObject'];
const AI_GENERATION_OPS = ['ai.run.doGenerate'];
const AI_TOOL_CALL_OPS = ['ai.toolCall'];
const AI_OPS = [...AI_PIPELINE_OPS, ...AI_GENERATION_OPS, ...AI_TOOL_CALL_OPS];

export const AI_MODEL_ID_ATTRIBUTE = 'ai.model.id' as EAPSpanProperty;
export const AI_TOOL_NAME_ATTRIBUTE = 'ai.toolCall.name' as EAPSpanProperty;
const AI_TOKEN_USAGE_ATTRIBUTE = 'ai.total_tokens.used';

export const AI_TOKEN_USAGE_ATTRIBUTE_SUM = `sum(${AI_TOKEN_USAGE_ATTRIBUTE})`;

// TODO: Remove once tool spans have their own op
function mapMissingSpanOp({
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

export function getIsAiSpan({op, description}: {description?: string; op?: string}) {
  const mappedOp = mapMissingSpanOp({op, description});
  return AI_OPS.includes(mappedOp);
}

export const getAgentRunsFilter = () => {
  return `span.op:[${AI_PIPELINE_OPS.join(',')}]`;
};

export const getLLMGenerationsFilter = () => {
  return `span.op:[${AI_GENERATION_OPS.join(',')}]`;
};

export const getAIToolCallsFilter = () => {
  return `span.description:[${AI_TOOL_CALL_OPS.join(',')}]`;
};

export const getAITracesFilter = () => {
  return `has:${AI_MODEL_ID_ATTRIBUTE}`;
};
