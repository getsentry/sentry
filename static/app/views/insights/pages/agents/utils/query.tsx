export function getIsAiAgentSpan(genAiOpType: string | undefined) {
  return genAiOpType === 'agent';
}

export function getIsExecuteToolSpan(genAiOpType: string | undefined) {
  return genAiOpType === 'tool';
}

export function getIsHandoffSpan(genAiOpType: string | undefined) {
  return genAiOpType === 'handoff';
}

export function getIsAiGenerationSpan(genAiOpType: string | undefined) {
  return genAiOpType === 'ai_client';
}

export function getHasAiSpansFilter() {
  return `has:gen_ai.operation.name`;
}

export const getAgentRunsFilter = ({negated = false}: {negated?: boolean} = {}) => {
  return `${negated ? '!' : ''}gen_ai.operation.type:agent`;
};

export const getToolSpansFilter = () => {
  return `gen_ai.operation.type:tool`;
};

export const getAIGenerationsFilter = () => {
  return `gen_ai.operation.type:ai_client`;
};
