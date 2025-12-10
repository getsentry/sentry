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

// Should be used only when we don't have the gen_ai.operation.type attribute available
export const getGenAiOperationTypeFromSpanOp = (spanOp?: string): string | undefined => {
  if (!spanOp?.startsWith('gen_ai.')) {
    return undefined;
  }

  if (spanOp.includes('agent')) {
    return 'agent';
  }
  if (spanOp.includes('tool')) {
    return 'tool';
  }
  if (spanOp.includes('handoff')) {
    return 'handoff';
  }
  return 'ai_client';
};
