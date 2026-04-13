import {escapeDoubleQuotes} from 'sentry/utils';
import {SpanFields} from 'sentry/views/insights/types';

export function getIsAiAgentSpan(genAiOpType: string | undefined) {
  return genAiOpType === 'agent';
}

export function getIsExecuteToolSpan(genAiOpType: string | undefined) {
  return genAiOpType === 'tool';
}

export function getIsAiGenerationSpan(genAiOpType: string | undefined) {
  return genAiOpType === 'ai_client';
}

export function getHasAiSpansFilter() {
  return 'has:gen_ai.operation.type';
}

export const getAgentRunsFilter = ({negated = false}: {negated?: boolean} = {}) => {
  return `${negated ? '!' : ''}gen_ai.operation.type:agent`;
};

export const getToolSpansFilter = () => {
  return 'gen_ai.operation.type:tool';
};

export const getAgentAndAIClientFilter = () => {
  return 'gen_ai.operation.type:[agent, ai_client]';
};

export const getAIGenerationsFilter = () => {
  return 'gen_ai.operation.type:ai_client';
};

/**
 * Agent name fallback filters.
 *
 * The Vercel AI SDK sends `gen_ai.function_id` instead of the standard
 * `gen_ai.agent.name` attribute. The filters below check both fields so
 * agent identification works regardless of which attribute the SDK sets.
 */

/**
 * Returns a search filter that matches spans having an agent name
 * (either `gen_ai.agent.name` or `gen_ai.function_id`).
 */
export function getHasAgentNameFilter(): string {
  return `(has:${SpanFields.GEN_AI_AGENT_NAME} OR has:${SpanFields.GEN_AI_FUNCTION_ID})`;
}

/**
 * Returns a search filter matching specific agent names across both fields.
 */
export function getAgentNameSearchFilter(searchTerm: string): string {
  return `(${SpanFields.GEN_AI_AGENT_NAME}:*${searchTerm}* OR ${SpanFields.GEN_AI_FUNCTION_ID}:*${searchTerm}*)`;
}

/**
 * Returns a search filter for an exact set of agent names, checking both fields.
 */
export function getAgentNamesFilter(agents: string[]): string {
  if (agents.length === 0) {
    return '';
  }
  const values = agents.map(v => `"${escapeDoubleQuotes(v)}"`).join(', ');
  return `(${SpanFields.GEN_AI_AGENT_NAME}:[${values}] OR ${SpanFields.GEN_AI_FUNCTION_ID}:[${values}])`;
}

export enum GenAiOperationType {
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
