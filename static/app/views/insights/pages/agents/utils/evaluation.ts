/**
 * Parsing for `gen_ai.evaluate` spans. Evaluator SDKs record the evaluated
 * text and its questions on `gen_ai.input.messages`, and the answers on
 * `gen_ai.output.messages`, as a single `{"type": "evaluation"}` item rather
 * than chat messages.
 */

import round from 'lodash/round';
import {z} from 'zod';

import {t} from 'sentry/locale';
import type {EventTransaction} from 'sentry/types/event';
import type {TraceItemResponseAttribute} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {getTraceNodeAttribute} from 'sentry/views/insights/pages/agents/utils/aiTraceNodes';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';
import {SpanFields} from 'sentry/views/insights/types';

// Schemas describe the valid shape only and keep values as sent; ordering and
// other presentation happens when rendering. Optional fields may be missing,
// but a field that's present with the wrong type fails its whole question or
// answer, which is then shown raw instead of silently dropping the field.

// Matches anything, so it goes last in a union as the fallback.
const invalidEntrySchema = z
  .unknown()
  .transform(value => ({kind: 'invalid' as const, value}));

/** Probability per option or score value, e.g. `{"billing": 0.62}`. */
const probabilitiesSchema = z.record(z.string(), z.number());

const booleanAnswerSchema = z
  .object({type: z.literal('boolean'), probability: z.number()})
  .transform(({type: _type, ...answer}) => ({...answer, kind: 'boolean' as const}));

// `noul` is the boolean flavour used by the jev evaluator; its probability is
// stored under the type name instead of `probability`.
const noulAnswerSchema = z
  .object({type: z.literal('noul'), noul: z.number()})
  .transform(answer => ({kind: 'boolean' as const, probability: answer.noul}));

const scoreAnswerSchema = z
  .object({
    type: z.literal('score'),
    score: z.number(),
    probabilities: probabilitiesSchema.optional(),
    confidence: z.number().optional(),
    /** Names for each score value, e.g. `{"0": "low", "2": "high"}`. */
    legend: z.record(z.string(), z.string()).optional(),
  })
  .transform(({type: _type, ...answer}) => ({...answer, kind: 'score' as const}));

const choiceAnswerSchema = z
  .object({
    type: z.literal('choice'),
    choice: z.string(),
    probabilities: probabilitiesSchema.optional(),
    confidence: z.number().optional(),
  })
  .transform(({type: _type, ...answer}) => ({...answer, kind: 'choice' as const}));

const answerSchema = z.union([
  booleanAnswerSchema,
  noulAnswerSchema,
  scoreAnswerSchema,
  choiceAnswerSchema,
  invalidEntrySchema,
]);

const questionSchema = z.union([
  z
    .object({
      type: z.string(),
      instructions: z.string().optional(),
      /**
       * The allowed answers. Score questions list their scale, where the index
       * is the score value (`["low", "medium", "high"]`); choice questions
       * describe each option (`{"billing": "Charges and refunds"}`).
       */
      criteria: z
        .union([z.array(z.string()), z.record(z.string(), z.string())])
        .optional(),
    })
    .transform(question => ({...question, kind: 'question' as const})),
  invalidEntrySchema,
]);

type WithKey<T> = T & {key: string};

export type EvaluationAnswer = WithKey<z.output<typeof answerSchema>>;
export type EvaluationQuestionEntry = WithKey<z.output<typeof questionSchema>>;
export type EvaluationQuestion = Extract<EvaluationQuestionEntry, {kind: 'question'}>;
export type ScoreAnswer = Extract<EvaluationAnswer, {kind: 'score'}>;

/**
 * A question or answer that doesn't match the expected shape: an unknown type,
 * or a known type with a field of the wrong type. Shown as its raw value.
 */
export type InvalidEvaluationEntry = Extract<EvaluationAnswer, {kind: 'invalid'}>;

export interface EvaluationInput {
  questions: EvaluationQuestionEntry[];
  state: unknown;
  /** Set when `questions` isn't a map of questions, holding its raw value. */
  invalidQuestions?: {value: unknown};
}

const questionsSchema = z.record(z.string(), questionSchema);

const inputItemSchema = z.object({
  type: z.literal('evaluation'),
  // The evaluated text is the core of the input, so it must be present.
  state: z.unknown().refine(state => state !== undefined),
  questions: z.unknown(),
});

const outputItemSchema = z.object({
  type: z.literal('evaluation'),
  answers: z.record(z.string(), answerSchema),
});

/**
 * Parses a messages attribute and returns its first item matching `schema`.
 */
function findEvaluationItem<T extends z.ZodType>(
  raw: unknown,
  schema: T
): z.output<T> | null {
  if (typeof raw !== 'string') {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const items: unknown[] = Array.isArray(parsed) ? parsed : [parsed];
  for (const item of items) {
    const result = schema.safeParse(item);
    if (result.success) {
      return result.data;
    }
  }
  return null;
}

/**
 * Parses the evaluated text and questions, or returns null when the message
 * isn't an evaluation.
 */
export function parseEvaluationInput(raw: unknown): EvaluationInput | null {
  const item = findEvaluationItem(raw, inputItemSchema);
  if (!item) {
    return null;
  }
  if (item.questions === undefined) {
    return {state: item.state, questions: []};
  }
  const questions = questionsSchema.safeParse(item.questions);
  if (!questions.success) {
    return {state: item.state, questions: [], invalidQuestions: {value: item.questions}};
  }
  return {
    state: item.state,
    questions: Object.entries(questions.data).map(
      ([key, question]): EvaluationQuestionEntry => ({key, ...question})
    ),
  };
}

/**
 * Parses the answers, or returns null when the message isn't an evaluation.
 */
export function parseEvaluationOutput(raw: unknown): EvaluationAnswer[] | null {
  const item = findEvaluationItem(raw, outputItemSchema);
  if (!item) {
    return null;
  }
  return Object.entries(item.answers).map(([key, answer]): EvaluationAnswer => ({
    key,
    ...answer,
  }));
}

/**
 * Whether a span is an evaluation, from its `gen_ai.operation.name`.
 */
export function isEvaluationNode(
  node: AITraceSpanNode,
  attributes?: TraceItemResponseAttribute[],
  event?: EventTransaction
): boolean {
  return (
    getTraceNodeAttribute(SpanFields.GEN_AI_OPERATION_NAME, node, event, attributes) ===
    'evaluate'
  );
}

export interface Evaluation {
  /**
   * Null when the output isn't in the evaluation format, e.g. it's malformed or
   * the call failed.
   */
  answers: EvaluationAnswer[] | null;
  /** Null when the input isn't in the evaluation format. */
  input: EvaluationInput | null;
  rawInput: string | undefined;
  rawOutput: string | undefined;
}

/**
 * Reads the evaluation recorded on an evaluation span, or null for any other
 * span. Parts that can't be read are null, so callers can show them raw.
 */
export function getNodeEvaluation(
  node: AITraceSpanNode,
  attributes?: TraceItemResponseAttribute[],
  event?: EventTransaction
): Evaluation | null {
  if (!isEvaluationNode(node, attributes, event)) {
    return null;
  }
  const rawInput = getTraceNodeAttribute(
    SpanFields.GEN_AI_INPUT_MESSAGES,
    node,
    event,
    attributes
  );
  const rawOutput = getTraceNodeAttribute(
    SpanFields.GEN_AI_OUTPUT_MESSAGES,
    node,
    event,
    attributes
  );
  return {
    input: parseEvaluationInput(rawInput),
    answers: parseEvaluationOutput(rawOutput),
    rawInput: typeof rawInput === 'string' ? rawInput : undefined,
    rawOutput: typeof rawOutput === 'string' ? rawOutput : undefined,
  };
}

/**
 * The valid question an answer responds to, if any.
 */
export function findQuestion(
  questions: EvaluationQuestionEntry[] | undefined,
  key: string
): EvaluationQuestion | undefined {
  return questions?.find(
    (question): question is EvaluationQuestion =>
      question.kind === 'question' && question.key === key
  );
}

/**
 * The name for a score value, from the answer's legend or else the question's
 * criteria. Fractional scores use the closest value, e.g. 1.6 is "high" on
 * `["low", "medium", "high"]`.
 */
export function getScoreName(
  answer: ScoreAnswer,
  value: number,
  question?: EvaluationQuestion
): string | undefined {
  const index = Math.round(value);
  const scale = Array.isArray(question?.criteria) ? question.criteria : undefined;
  return answer.legend?.[index] ?? scale?.[index];
}

/**
 * `[key, label]` for each answer with a short label, e.g.
 * `["urgency", "high (1.6)"]`, for one-line summaries. Invalid answers are
 * skipped.
 */
export function getAnswerLabels(
  answers: EvaluationAnswer[],
  questions?: EvaluationQuestionEntry[]
): Array<[string, string]> {
  return answers.flatMap(answer => {
    const label = getAnswerLabel(answer, findQuestion(questions, answer.key));
    return label === null ? [] : [[answer.key, label] as [string, string]];
  });
}

/**
 * A short text form of an answer, e.g. "Yes", "billing" or "high (1.6)". Null
 * for invalid answers.
 */
export function getAnswerLabel(
  answer: EvaluationAnswer,
  question?: EvaluationQuestion
): string | null {
  switch (answer.kind) {
    case 'boolean':
      return answer.probability >= 0.5 ? t('Yes') : t('No');
    case 'score': {
      const score = String(round(answer.score, 2));
      const name = getScoreName(answer, answer.score, question);
      return name ? `${name} (${score})` : score;
    }
    case 'choice':
      return answer.choice;
    default:
      return null;
  }
}
