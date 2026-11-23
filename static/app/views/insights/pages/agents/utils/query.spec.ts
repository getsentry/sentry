import {
  GenAiOperationType,
  getAgentRunsFilter,
  getAiClientSpansFilter,
  getGenAiOperationTypeFromSpanName,
  getToolSpansFilter,
} from './query';

describe('AI operation type filters', () => {
  it('filters agent runs', () => {
    expect(getAgentRunsFilter()).toBe('gen_ai.operation.type:agent');
    expect(getAgentRunsFilter({negated: true})).toBe('!gen_ai.operation.type:agent');
  });

  it('filters tool spans', () => {
    expect(getToolSpansFilter()).toBe('gen_ai.operation.type:tool');
  });

  it('filters AI client spans', () => {
    expect(getAiClientSpansFilter()).toBe('gen_ai.operation.type:ai_client');
  });
});

describe('getGenAiOperationTypeFromSpanName', () => {
  it('returns undefined for undefined input', () => {
    expect(getGenAiOperationTypeFromSpanName(undefined)).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(getGenAiOperationTypeFromSpanName('')).toBeUndefined();
  });

  it('returns undefined for non-gen_ai span names', () => {
    expect(getGenAiOperationTypeFromSpanName('http.client')).toBeUndefined();
    expect(getGenAiOperationTypeFromSpanName('db.query')).toBeUndefined();
    expect(getGenAiOperationTypeFromSpanName('mcp.server')).toBeUndefined();
  });

  it('returns AGENT for gen_ai.invoke_agent', () => {
    expect(getGenAiOperationTypeFromSpanName('gen_ai.invoke_agent')).toBe(
      GenAiOperationType.AGENT
    );
  });

  it('returns AGENT for gen_ai.create_agent', () => {
    expect(getGenAiOperationTypeFromSpanName('gen_ai.create_agent')).toBe(
      GenAiOperationType.AGENT
    );
  });

  it('returns TOOL for gen_ai.execute_tool', () => {
    expect(getGenAiOperationTypeFromSpanName('gen_ai.execute_tool')).toBe(
      GenAiOperationType.TOOL
    );
  });

  it('returns HANDOFF for gen_ai.handoff', () => {
    expect(getGenAiOperationTypeFromSpanName('gen_ai.handoff')).toBe(
      GenAiOperationType.HANDOFF
    );
  });

  it('returns AI_CLIENT for other gen_ai span names', () => {
    expect(getGenAiOperationTypeFromSpanName('gen_ai.chat')).toBe(
      GenAiOperationType.AI_CLIENT
    );
    expect(getGenAiOperationTypeFromSpanName('gen_ai.completion')).toBe(
      GenAiOperationType.AI_CLIENT
    );
    expect(getGenAiOperationTypeFromSpanName('gen_ai.embeddings')).toBe(
      GenAiOperationType.AI_CLIENT
    );
  });
});
