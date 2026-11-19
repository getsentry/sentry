import {getAgentNamesFilter} from 'sentry/views/insights/pages/agents/utils/query';

import {getClassifierFilterParts, getEnvironmentsFilter, getFilterTree} from './utils';

describe('getEnvironmentsFilter', () => {
  it('returns an empty filter without environments', () => {
    expect(getEnvironmentsFilter([])).toBe('');
  });

  it('quotes every environment', () => {
    expect(getEnvironmentsFilter(['production', 'staging'])).toBe(
      'environment:["production", "staging"]'
    );
  });

  it('escapes double quotes', () => {
    expect(getEnvironmentsFilter(['a"b'])).toBe('environment:["a\\"b"]');
  });
});

describe('getFilterTree', () => {
  it('flattens filters joined by AND', () => {
    expect(
      getFilterTree('(environment:production) AND (conversation.messages:>10)')
    ).toEqual([
      expect.objectContaining({type: 'filter', query: 'environment:production'}),
      expect.objectContaining({type: 'filter', query: 'conversation.messages:>10'}),
    ]);
  });

  it('groups filters joined by OR', () => {
    expect(getFilterTree('(agent:a OR function:b)')).toEqual([
      expect.objectContaining({
        type: 'any',
        options: [
          [expect.objectContaining({query: 'agent:a'})],
          [expect.objectContaining({query: 'function:b'})],
        ],
      }),
    ]);
  });

  it('keeps AND binding tighter than OR', () => {
    expect(getFilterTree('env:prod agent:a OR function:b')).toEqual([
      expect.objectContaining({
        type: 'any',
        options: [
          [
            expect.objectContaining({query: 'env:prod'}),
            expect.objectContaining({query: 'agent:a'}),
          ],
          [expect.objectContaining({query: 'function:b'})],
        ],
      }),
    ]);
  });

  it('nests OR groups inside AND', () => {
    expect(getFilterTree('env:prod (agent:a OR function:b)')).toEqual([
      expect.objectContaining({type: 'filter', query: 'env:prod'}),
      expect.objectContaining({type: 'any'}),
    ]);
  });

  it('returns an empty tree for an empty query', () => {
    expect(getFilterTree('')).toEqual([]);
  });
});

describe('getClassifierFilterParts', () => {
  const environmentFilter = getEnvironmentsFilter(['production', 'staging']);
  const agentFilter = getAgentNamesFilter(['seer_chat']);

  it('extracts the environment and agent selectors', () => {
    expect(getClassifierFilterParts(`${environmentFilter} ${agentFilter}`)).toEqual({
      environments: ['production', 'staging'],
      agents: ['seer_chat'],
      query: '',
    });
  });

  it('separates the selectors from the search query', () => {
    expect(
      getClassifierFilterParts(
        `(${environmentFilter} ${agentFilter}) and (conversation.messages:>10 OR conversation.errors:>=1)`
      )
    ).toEqual({
      environments: ['production', 'staging'],
      agents: ['seer_chat'],
      query: 'conversation.messages:>10 OR conversation.errors:>=1',
    });
  });

  it('extracts the agent selector without an environment', () => {
    expect(getClassifierFilterParts(`(${agentFilter}) and (span.op:chat)`)).toEqual({
      environments: [],
      agents: ['seer_chat'],
      query: 'span.op:chat',
    });
  });

  it('keeps a query without selectors as the search query', () => {
    expect(
      getClassifierFilterParts('(gen_ai.agent.name:a) and (conversation.messages:>10)')
    ).toEqual({
      environments: [],
      agents: [],
      query: '(gen_ai.agent.name:a) and (conversation.messages:>10)',
    });
  });

  it('does not treat mismatched agent filters as the selector', () => {
    const query = '(gen_ai.agent.name:["a"] OR gen_ai.function_id:["b"])';
    expect(getClassifierFilterParts(query)).toEqual({
      environments: [],
      agents: [],
      query,
    });
  });
});
