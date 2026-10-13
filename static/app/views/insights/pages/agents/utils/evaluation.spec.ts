import {
  getAnswerLabel,
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
      state: 'I cannot log in.',
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

  it('keeps malformed questions as raw values', () => {
    const raw = JSON.stringify([
      {
        type: 'evaluation',
        state: 'text',
        questions: {urgency: {type: 'score', criteria: 'low'}},
      },
    ]);

    expect(parseEvaluationInput(raw)?.questions).toEqual([
      {key: 'urgency', kind: 'invalid', value: {type: 'score', criteria: 'low'}},
    ]);
  });

  it('keeps questions that are not a map as a raw value', () => {
    const raw = JSON.stringify([
      {type: 'evaluation', state: 'text', questions: ['authIssue']},
    ]);

    expect(parseEvaluationInput(raw)).toEqual({
      state: 'text',
      questions: [],
      invalidQuestions: {value: ['authIssue']},
    });
  });

  it('allows evaluations without questions', () => {
    const raw = JSON.stringify([{type: 'evaluation', state: 'text'}]);
    expect(parseEvaluationInput(raw)).toEqual({state: 'text', questions: []});
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
        },
      },
    ]);

    expect(parseEvaluationOutput(raw)).toEqual([
      {kind: 'boolean', key: 'authIssue', probability: 0.97},
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
});
