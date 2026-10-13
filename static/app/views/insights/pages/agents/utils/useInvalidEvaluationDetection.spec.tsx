import * as Sentry from '@sentry/react';

import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import type {Evaluation} from 'sentry/views/insights/pages/agents/utils/evaluation';
import {useInvalidEvaluationDetection} from 'sentry/views/insights/pages/agents/utils/useInvalidEvaluationDetection';

describe('useInvalidEvaluationDetection', () => {
  let captureSpy: jest.SpyInstance;

  beforeEach(() => {
    captureSpy = jest.spyOn(Sentry, 'captureMessage').mockImplementation(() => '');
  });

  afterEach(() => {
    captureSpy.mockRestore();
  });

  it('does not report readable evaluations', () => {
    const evaluation: Evaluation = {
      input: {state: 'text', questions: []},
      answers: [{kind: 'boolean', key: 'authIssue', probability: 0.97}],
      rawInput: '[]',
      rawOutput: '[]',
    };

    renderHookWithProviders(() => useInvalidEvaluationDetection(evaluation));

    expect(captureSpy).not.toHaveBeenCalled();
  });

  it('reports unreadable parts without their content', () => {
    const evaluation: Evaluation = {
      input: null,
      answers: [
        {kind: 'invalid', key: 'custom', value: {type: 'rating', stars: 4}},
        {kind: 'boolean', key: 'authIssue', probability: 0.97},
      ],
      rawInput: 'not json',
      rawOutput: '[]',
    };

    renderHookWithProviders(() => useInvalidEvaluationDetection(evaluation));

    expect(captureSpy).toHaveBeenCalledTimes(1);
    expect(captureSpy).toHaveBeenCalledWith('Gen AI evaluation with unreadable parts', {
      level: 'warning',
      tags: {
        feature: 'agent-monitoring',
        unreadable_input: true,
        unreadable_output: false,
        unreadable_questions: false,
        invalid_question_count: 0,
        invalid_answer_count: 1,
      },
      extra: {invalid_question_types: [], invalid_answer_types: ['rating']},
    });
  });

  it('reports once per evaluation, not on every render', () => {
    const evaluation: Evaluation = {
      input: null,
      answers: null,
      rawInput: 'not json',
      rawOutput: undefined,
    };

    const {rerender} = renderHookWithProviders(() =>
      useInvalidEvaluationDetection(evaluation)
    );
    rerender();

    expect(captureSpy).toHaveBeenCalledTimes(1);
  });
});
