import {
  evaluatedStateToText,
  getAnswerLabel,
  getEvaluationResults,
  getNodeEvaluation,
  parseEvaluationInput,
  parseEvaluationOutput,
  type ScoreAnswer,
} from 'sentry/views/insights/pages/agents/utils/evaluation';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';

function makeNode(attributes: Record<string, string>): AITraceSpanNode {
  return {errors: new Set(), attributes} as unknown as AITraceSpanNode;
}

const RAW_INPUT = JSON.stringify([
  {
    type: 'evaluation',
    state: 'I cannot log in.',
    questions: {
      urgency: {type: 'score', criteria: ['low', 'medium', 'high']},
    },
  },
]);

const RAW_OUTPUT = JSON.stringify([
  {
    type: 'evaluation',
    answers: {urgency: {type: 'score', score: 1.6}},
  },
]);

describe('parseEvaluationInput', () => {
  it('parses the evaluated text and questions', () => {
    const raw = JSON.stringify([
      {
        type: 'evaluation',
        state: 'I cannot log in.',
        questions: {
          authIssue: {type: 'boolean', instructions: 'Is there a login problem?'},
          urgency: {type: 'score', criteria: ['low', 'medium', 'high']},
          department: {
            type: 'choice',
            criteria: {billing: 'Charges and refunds', technical: 'Bugs and outages'},
          },
        },
      },
    ]);

    expect(parseEvaluationInput(raw)).toEqual({
      state: [{parts: [{kind: 'text', text: 'I cannot log in.'}]}],
      questions: [
        {
          key: 'authIssue',
          kind: 'question',
          type: 'boolean',
          instructions: 'Is there a login problem?',
        },
        {
          key: 'urgency',
          kind: 'question',
          type: 'score',
          criteria: ['low', 'medium', 'high'],
        },
        {
          key: 'department',
          kind: 'question',
          type: 'choice',
          criteria: {billing: 'Charges and refunds', technical: 'Bugs and outages'},
        },
      ],
    });
  });

  it('reads boolean choice options as strings', () => {
    const raw = JSON.stringify([
      {
        type: 'evaluation',
        state: 'Win a free cruise!',
        questions: {
          // As recorded by the JavaScript SDK for OpenAI decisions.
          isSpam: {type: 'choice', criteria: {true: '', false: 'Not spam'}},
          isAd: {type: 'choice', criteria: [true, false]},
        },
      },
    ]);

    expect(parseEvaluationInput(raw)?.questions).toEqual([
      {
        key: 'isSpam',
        kind: 'question',
        type: 'choice',
        criteria: {true: '', false: 'Not spam'},
      },
      {key: 'isAd', kind: 'question', type: 'choice', criteria: ['true', 'false']},
    ]);
  });

  it('parses score level descriptions', () => {
    const raw = JSON.stringify([
      {
        type: 'evaluation',
        state: 'I was charged twice.',
        questions: {
          urgency: {
            type: 'score',
            criteria: ['low', 'medium', 'high'],
            descriptions: {1: 'Needs a reply today', 2: 'Blocks the customer'},
          },
        },
      },
    ]);

    expect(parseEvaluationInput(raw)?.questions).toEqual([
      {
        key: 'urgency',
        kind: 'question',
        type: 'score',
        criteria: ['low', 'medium', 'high'],
        descriptions: {1: 'Needs a reply today', 2: 'Blocks the customer'},
      },
    ]);
  });

  it('keeps malformed questions as raw values', () => {
    const raw = JSON.stringify([
      {
        type: 'evaluation',
        state: 'text',
        questions: {
          urgency: {type: 'score', criteria: 'low'},
          severity: {type: 'score', criteria: ['low'], descriptions: ['Minor']},
        },
      },
    ]);

    expect(parseEvaluationInput(raw)?.questions).toEqual([
      {key: 'urgency', kind: 'invalid', value: {type: 'score', criteria: 'low'}},
      {
        key: 'severity',
        kind: 'invalid',
        value: {type: 'score', criteria: ['low'], descriptions: ['Minor']},
      },
    ]);
  });

  it('keeps questions that are not a map as a raw value', () => {
    const raw = JSON.stringify([
      {type: 'evaluation', state: 'text', questions: ['authIssue']},
    ]);

    expect(parseEvaluationInput(raw)).toEqual({
      state: [{parts: [{kind: 'text', text: 'text'}]}],
      questions: [],
      invalidQuestions: {value: ['authIssue']},
    });
  });

  it('allows evaluations without questions', () => {
    const raw = JSON.stringify([{type: 'evaluation', state: 'text'}]);
    expect(parseEvaluationInput(raw)).toEqual({
      state: [{parts: [{kind: 'text', text: 'text'}]}],
      questions: [],
    });
  });

  it('returns null without an evaluated text', () => {
    const raw = JSON.stringify([{type: 'evaluation', questions: {}}]);
    expect(parseEvaluationInput(raw)).toBeNull();
  });

  it('returns null for invalid JSON', () => {
    expect(parseEvaluationInput('[{"type":"evaluation"')).toBeNull();
    expect(parseEvaluationInput(undefined)).toBeNull();
  });
});

describe('parseEvaluationOutput', () => {
  it('parses every answer type', () => {
    const raw = JSON.stringify([
      {
        type: 'evaluation',
        answers: {
          authIssue: {type: 'boolean', probability: 0.97},
          isRed: {type: 'predicate', probability: 0.7},
          wantsRefund: {type: 'noul', noul: 0.99},
          urgency: {
            type: 'score',
            score: 1.6,
            legend: {0: 'low', 1: 'medium', 2: 'high'},
            probabilities: {2: 0.6, 0: 0, 1: 0.4},
            confidence: 0.4,
          },
          department: {
            type: 'choice',
            choice: 'billing',
            probabilities: {technical: 0.35, billing: 0.59},
            confidence: 0.24,
          },
          tone: {type: 'refusal'},
        },
      },
    ]);

    expect(parseEvaluationOutput(raw)).toEqual([
      {kind: 'boolean', key: 'authIssue', probability: 0.97},
      {kind: 'boolean', key: 'isRed', probability: 0.7},
      {kind: 'boolean', key: 'wantsRefund', probability: 0.99},
      {
        kind: 'score',
        key: 'urgency',
        score: 1.6,
        probabilities: {0: 0, 1: 0.4, 2: 0.6},
        confidence: 0.4,
        legend: {0: 'low', 1: 'medium', 2: 'high'},
      },
      {
        kind: 'choice',
        key: 'department',
        choice: 'billing',
        probabilities: {technical: 0.35, billing: 0.59},
        confidence: 0.24,
      },
      {kind: 'refusal', key: 'tone'},
    ]);
  });

  it('reads boolean choices as strings', () => {
    const raw = JSON.stringify([
      {
        type: 'evaluation',
        answers: {
          // As recorded by the JavaScript SDK for OpenAI decisions.
          isSpam: {
            type: 'choice',
            choice: 'true',
            probabilities: {true: 0.91, false: 0.09},
            confidence: 0.91,
          },
          isAd: {type: 'choice', choice: false},
        },
      },
    ]);

    expect(parseEvaluationOutput(raw)).toEqual([
      {
        kind: 'choice',
        key: 'isSpam',
        choice: 'true',
        probabilities: {true: 0.91, false: 0.09},
        confidence: 0.91,
      },
      {kind: 'choice', key: 'isAd', choice: 'false'},
    ]);
  });

  it('keeps unknown and malformed answers as raw values', () => {
    const department = {type: 'choice', choice: 'billing', confidence: 'high'};
    const raw = JSON.stringify([
      {type: 'evaluation', answers: {custom: {type: 'rating', stars: 4}, department}},
    ]);

    expect(parseEvaluationOutput(raw)).toEqual([
      {kind: 'invalid', key: 'custom', value: {type: 'rating', stars: 4}},
      {kind: 'invalid', key: 'department', value: department},
    ]);
  });

  it('returns null without answers', () => {
    expect(parseEvaluationOutput(JSON.stringify([{type: 'evaluation'}]))).toBeNull();
  });
});

describe('getNodeEvaluation', () => {
  it('parses each message and keeps unreadable ones raw', () => {
    const evaluation = getNodeEvaluation(
      makeNode({
        'gen_ai.operation.name': 'evaluate',
        'gen_ai.input.messages': 'not json',
        'gen_ai.output.messages': RAW_OUTPUT,
      })
    );

    expect(evaluation).toEqual({
      input: null,
      answers: [{kind: 'score', key: 'urgency', score: 1.6}],
      rawInput: 'not json',
      rawOutput: RAW_OUTPUT,
    });
  });

  it.each(['decide', 'evaluate'])(
    'recognizes a span with the %s operation name',
    operationName => {
      const evaluation = getNodeEvaluation(
        makeNode({
          'gen_ai.operation.name': operationName,
          'gen_ai.input.messages': RAW_INPUT,
          'gen_ai.output.messages': RAW_OUTPUT,
        })
      );

      expect(evaluation).toEqual({
        input: {
          state: [{parts: [{kind: 'text', text: 'I cannot log in.'}]}],
          questions: [
            {
              key: 'urgency',
              kind: 'question',
              type: 'score',
              criteria: ['low', 'medium', 'high'],
            },
          ],
        },
        answers: [{kind: 'score', key: 'urgency', score: 1.6}],
        rawInput: RAW_INPUT,
        rawOutput: RAW_OUTPUT,
      });
    }
  );

  it('returns null for other spans, even with an evaluation message', () => {
    expect(
      getNodeEvaluation(
        makeNode({
          'gen_ai.operation.name': 'chat',
          'gen_ai.input.messages': RAW_INPUT,
        })
      )
    ).toBeNull();
  });
});

describe('evaluation state normalization', () => {
  const parseState = (state: unknown) =>
    parseEvaluationInput(JSON.stringify([{type: 'evaluation', state}]))?.state;

  it('wraps a plain string in one text message', () => {
    expect(parseState('I cannot log in.')).toEqual([
      {parts: [{kind: 'text', text: 'I cannot log in.'}]},
    ]);
  });

  it('parses a message array into text and image parts', () => {
    expect(
      parseState([
        {
          role: 'user',
          content: [
            {type: 'input_text', text: 'Is this image mostly red?'},
            {type: 'input_image', image_url: 'data:image/png;base64,iVBORw0KGgo'},
          ],
        },
      ])
    ).toEqual([
      {
        role: 'user',
        parts: [{kind: 'text', text: 'Is this image mostly red?'}, {kind: 'image'}],
      },
    ]);
  });

  it('parses an image part without its data', () => {
    expect(parseState([{role: 'user', content: [{type: 'input_image'}]}])).toEqual([
      {role: 'user', parts: [{kind: 'image'}]},
    ]);
  });

  it('treats a string message content as a single text part', () => {
    expect(parseState([{role: 'user', content: 'Plain text'}])).toEqual([
      {role: 'user', parts: [{kind: 'text', text: 'Plain text'}]},
    ]);
  });

  it('wraps an unrecognized shape in one raw message', () => {
    expect(parseState({foo: 'bar'})).toEqual([
      {parts: [{kind: 'raw', value: {foo: 'bar'}}]},
    ]);
    expect(parseState([{role: 'user', content: [{type: 'input_audio'}]}])).toEqual([
      {parts: [{kind: 'raw', value: [{role: 'user', content: [{type: 'input_audio'}]}]}]},
    ]);
  });
});

describe('evaluatedStateToText', () => {
  it('renders an image part as a placeholder', () => {
    expect(
      evaluatedStateToText([
        {
          role: 'user',
          parts: [{kind: 'text', text: 'Is this image mostly red?'}, {kind: 'image'}],
        },
      ])
    ).toBe('Is this image mostly red?\n[image]');
  });

  it('keeps plain text unchanged', () => {
    expect(
      evaluatedStateToText([{parts: [{kind: 'text', text: 'I cannot log in.'}]}])
    ).toBe('I cannot log in.');
  });
});

describe('getAnswerLabel', () => {
  it('names scores after the legend, then the question criteria', () => {
    const score: ScoreAnswer = {kind: 'score', key: 'a', score: 1.6};

    expect(getAnswerLabel(score)).toBe('1.6');
    expect(getAnswerLabel({...score, legend: {2: 'high'}})).toBe('high (1.6)');
    expect(
      getAnswerLabel(score, {
        key: 'a',
        kind: 'question',
        type: 'score',
        criteria: ['low', 'medium', 'critical'],
      })
    ).toBe('critical (1.6)');
  });

  it('labels a refusal', () => {
    expect(getAnswerLabel({kind: 'refusal', key: 'urgency'})).toBe('Refused');
  });
});

describe('getEvaluationResults', () => {
  it('pairs answers with questions by key, in question order', () => {
    const urgency = {key: 'urgency', kind: 'question' as const, type: 'score'};
    const authIssue = {key: 'authIssue', kind: 'question' as const, type: 'boolean'};
    const authAnswer = {kind: 'boolean' as const, key: 'authIssue', probability: 0.9};
    const extraAnswer = {kind: 'choice' as const, key: 'department', choice: 'billing'};

    expect(getEvaluationResults([urgency, authIssue], [extraAnswer, authAnswer])).toEqual(
      [
        {key: 'urgency', question: urgency, answer: undefined},
        {key: 'authIssue', question: authIssue, answer: authAnswer},
        {key: 'department', answer: extraAnswer},
      ]
    );
  });
});
