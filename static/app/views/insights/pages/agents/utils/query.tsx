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
  return `has:gen_ai.operation.type`;
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

enum GenAiOperationType {
  AGENT = 'agent',
  TOOL = 'tool',
  HANDOFF = 'handoff',
  AI_CLIENT = 'ai_client',
}

// Should be used only when we don't have the gen_ai.operation.type attribute available
export const getGenAiOperationTypeFromSpanOp = (
  spanOp?: string
): GenAiOperationType | undefined => {
  if (!spanOp?.startsWith('gen_ai.')) {
    return undefined;
  }

  if (['gen_ai.invoke_agent', 'gen_ai.create_agent'].includes(spanOp)) {
    return GenAiOperationType.AGENT;
  }
  if (spanOp === 'gen_ai.execute_tool') {
    return GenAiOperationType.TOOL;
  }
  if (spanOp === 'gen_ai.handoff') {
    return GenAiOperationType.HANDOFF;
  }
  return GenAiOperationType.AI_CLIENT;
};
