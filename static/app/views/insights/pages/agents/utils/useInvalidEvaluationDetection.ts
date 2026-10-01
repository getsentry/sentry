import {useEffect, useEffectEvent} from 'react';
import * as Sentry from '@sentry/react';
import {z} from 'zod';

import type {
  Evaluation,
  InvalidEvaluationEntry,
} from 'sentry/views/insights/pages/agents/utils/evaluation';

const typedValueSchema = z.object({type: z.string()});

/**
 * The `type` of each invalid entry that has one, to spot new question or answer
 * types. Values themselves aren't reported since they hold customer content.
 */
function getInvalidTypes(entries: InvalidEvaluationEntry[]): string[] {
  return entries.flatMap(entry => {
    const result = typedValueSchema.safeParse(entry.value);
    return result.success ? [result.data.type] : [];
  });
}

/**
 * Reports evaluation spans whose messages don't match the expected format, so
 * we learn about SDK changes. These parts are shown raw in the UI, where users
 * can't fix them.
 */
export function useInvalidEvaluationDetection(evaluation: Evaluation | null) {
  const invalidQuestions =
    evaluation?.input?.questions.filter(question => question.kind === 'invalid') ?? [];
  const invalidAnswers =
    evaluation?.answers?.filter(answer => answer.kind === 'invalid') ?? [];
  const unreadableInput = Boolean(evaluation?.rawInput && !evaluation.input);
  const unreadableOutput = Boolean(evaluation?.rawOutput && !evaluation.answers);
  const unreadableQuestions = Boolean(evaluation?.input?.invalidQuestions);

  const hasIssues =
    unreadableInput ||
    unreadableOutput ||
    unreadableQuestions ||
    invalidQuestions.length > 0 ||
    invalidAnswers.length > 0;

  const captureMessage = useEffectEvent(() => {
    Sentry.captureMessage('Gen AI evaluation with unreadable parts', {
      level: 'warning',
      tags: {
        feature: 'agent-monitoring',
        unreadable_input: unreadableInput,
        unreadable_output: unreadableOutput,
        unreadable_questions: unreadableQuestions,
        invalid_question_count: invalidQuestions.length,
        invalid_answer_count: invalidAnswers.length,
      },
      extra: {
        invalid_question_types: getInvalidTypes(invalidQuestions),
        invalid_answer_types: getInvalidTypes(invalidAnswers),
      },
    });
  });

  // Keyed on the (memoized) evaluation so each span reports once, not on every
  // render.
  useEffect(() => {
    if (evaluation && hasIssues) {
      captureMessage();
    }
  }, [evaluation, hasIssues]);
}
