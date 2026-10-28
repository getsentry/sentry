import {
  getAgentRunsFilter,
  getAiClientSpansFilter,
  getToolSpansFilter,
} from 'sentry/views/insights/pages/agents/utils/query';

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
