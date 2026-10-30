import {
  getMetaAttributes,
  getScrubbedPlaceholders,
} from 'sentry/views/insights/pages/agents/utils/scrubbedPlaceholders';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';

function makeNode(attributes: Record<string, string>): AITraceSpanNode {
  return {errors: new Set(), attributes} as unknown as AITraceSpanNode;
}

function remarks(rem: Array<[string, string, number, number]>) {
  return {meta: {value: {'': {rem, len: 0}}}};
}

const INPUT = '[{"role":"user","content":"Find the account for [email]"}]';

describe('getScrubbedPlaceholders', () => {
  it('resolves replacement texts from the remarks', () => {
    const start = INPUT.indexOf('[email]');
    const node = makeNode({
      'gen_ai.input.messages': INPUT,
      ...getMetaAttributes({
        'gen_ai.input.messages': remarks([
          ['@email:replace', 's', start, start + '[email]'.length],
        ]),
      }),
    });

    expect(getScrubbedPlaceholders(node)).toEqual(
      new Map([['[email]', {remark: 's', ruleId: '@email:replace'}]])
    );
  });

  it('ignores ranges that do not cover a replacement text', () => {
    const node = makeNode({
      'gen_ai.input.messages': INPUT,
      ...getMetaAttributes({
        'gen_ai.input.messages': remarks([['@email:replace', 's', 0, 7]]),
      }),
    });

    expect(getScrubbedPlaceholders(node).size).toBe(0);
  });

  it('returns nothing when nothing was scrubbed', () => {
    const node = makeNode({'gen_ai.input.messages': INPUT});

    expect(getScrubbedPlaceholders(node).size).toBe(0);
  });
});
