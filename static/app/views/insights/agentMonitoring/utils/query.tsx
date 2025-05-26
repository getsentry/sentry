// These are the span op we are currently ingesting.
// They will probably change and maybe it will be enough to inline them in the widgets.
const AI_PIPELINE_OPS = ['ai.pipeline.generateText', 'ai.pipeline.generateObject'];
const AI_GENERATION_OPS = ['ai.run.doGenerate'];
const AI_TOOL_CALL_OPS = ['ai.toolCall'];

export const AI_MODEL_ID_ATTRIBUTE = 'ai.model.id';
export const AI_TOOL_NAME_ATTRIBUTE = 'ai.toolCall.name';
const AI_TOKEN_USAGE_ATTRIBUTE = 'ai.total_tokens.used';

export const AI_TOKEN_USAGE_ATTRIBUTE_SUM = `sum(${AI_TOKEN_USAGE_ATTRIBUTE})`;

export const getAgentRunsFilter = () => {
  return `span.op:[${AI_PIPELINE_OPS.join(',')}]`;
};

export const getLLMGenerationsFilter = () => {
  return `span.op:[${AI_GENERATION_OPS.join(',')}]`;
};

export const getAIToolCallsFilter = () => {
  return `span.description:[${AI_TOOL_CALL_OPS.join(',')}]`;
};
