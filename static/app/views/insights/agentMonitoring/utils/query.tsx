const AI_PIPELINE_OPS = ['ai.pipeline.generateText', 'ai.pipeline.generateObject'];

export const getAgentRunsFilter = () => {
  return `span.op:[${AI_PIPELINE_OPS.join(',')}]`;
};
