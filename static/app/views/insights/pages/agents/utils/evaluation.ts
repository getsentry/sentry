/**
 * Parsing for evaluation spans. Evaluator SDKs record the evaluated text and
 * its questions on `gen_ai.input.messages`, and the answers on
 * `gen_ai.output.messages`, as a single `{"type": "evaluation"}` item rather
 * than chat messages. The span is recognized by its `gen_ai.operation.name`:
 * `decide` is the current value, `evaluate` the deprecated one still emitted by
 * older SDKs, and both must keep working.
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

const optionSchema = z.union([z.string(), z.boolean().transform(String)]);

/** Probability per option or score value, e.g. `{"billing": 0.62}`. */
const probabilitiesSchema = z.record(z.string(), z.number());

const booleanAnswerSchema = z
  .object({type: z.literal(['boolean', 'predicate']), probability: z.number()})
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
    choice: optionSchema,
    probabilities: probabilitiesSchema.optional(),
    confidence: z.number().optional(),
  })
  .transform(({type: _type, ...answer}) => ({...answer, kind: 'choice' as const}));

// The model declined to answer the question. It carries no probability or
// reason, so there's nothing to render beyond the refusal itself.
const refusalAnswerSchema = z
  .object({type: z.literal('refusal')})
  .transform(() => ({kind: 'refusal' as const}));

const answerSchema = z.union([
  booleanAnswerSchema,
  noulAnswerSchema,
  scoreAnswerSchema,
  choiceAnswerSchema,
  refusalAnswerSchema,
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
        .union([z.array(optionSchema), z.record(z.string(), z.string())])
        .optional(),
      /** Descriptions of score values, e.g. `{"2": "Blocks the customer"}`. */
      descriptions: z.record(z.string(), z.string()).optional(),
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

// A chat-style `state`, e.g. `[{role: 'user', content: [{type: 'input_text',
// text: '...'}, {type: 'input_image', image_url: '...'}]}]`. It's normalized to a
// message list: text parts render as text, image parts as a placeholder, and
// anything unrecognized as raw JSON.
export type EvaluatedContentPart =
  | {kind: 'text'; text: string}
  | {kind: 'image'}
  | {kind: 'raw'; value: unknown};

export interface EvaluatedMessage {
  parts: EvaluatedContentPart[];
  role?: string;
}

const textPartSchema = z
  .object({type: z.literal('input_text'), text: z.string()})
  .transform((part): EvaluatedContentPart => ({kind: 'text', text: part.text}));

const imagePartSchema = z
  .object({type: z.literal('input_image')})
  .transform((): EvaluatedContentPart => ({kind: 'image'}));

const contentPartSchema = z.union([textPartSchema, imagePartSchema]);

const stateMessageSchema = z
  .object({
    role: z.string().optional(),
    content: z.union([z.string(), z.array(contentPartSchema)]),
  })
  .transform((message): EvaluatedMessage => ({
    role: message.role,
    parts:
      typeof message.content === 'string'
        ? [{kind: 'text', text: message.content}]
        : message.content,
  }));

// Every `state` normalizes to a message list: a plain string becomes one text
// message, an unrecognized value one raw-JSON message. `undefined` is rejected so
// an evaluation item without state doesn't match.
const evaluatedStateSchema = z.union([
  z.string().transform((text): EvaluatedMessage[] => [{parts: [{kind: 'text', text}]}]),
  z.array(stateMessageSchema).min(1),
  z
    .unknown()
    .refine(value => value !== undefined)
    .transform((value): EvaluatedMessage[] => [{parts: [{kind: 'raw', value}]}]),
]);

export interface EvaluationInput {
  questions: EvaluationQuestionEntry[];
  state: EvaluatedMessage[];
  /** Set when `questions` isn't a map of questions, holding its raw value. */
  invalidQuestions?: {value: unknown};
}

const questionsSchema = z.record(z.string(), questionSchema);

const inputItemSchema = z.object({
  type: z.literal('evaluation'),
  // The evaluated content is the core of the input, so it must be present.
  state: evaluatedStateSchema,
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
 * A plain-text form of the evaluated `state` for previews and exports, with
 * `[image]` standing in for each image part.
 */
export function evaluatedStateToText(state: EvaluatedMessage[]): string {
  return state
    .map(message =>
      message.parts
        .map(part =>
          part.kind === 'text'
            ? part.text
            : part.kind === 'image'
              ? '[image]'
              : JSON.stringify(part.value)
        )
        .join('\n')
    )
    .join('\n');
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
 * Well-known `gen_ai.operation.name` values for evaluation spans. `decide` is
 * the current value; `evaluate` is the deprecated one still emitted by older
 * SDKs.
 */
const EVALUATION_OPERATION_NAMES: ReadonlySet<string> = new Set(['decide', 'evaluate']);

/**
 * Whether a span is an evaluation, from its `gen_ai.operation.name`.
 */
export function isEvaluationNode(
  node: AITraceSpanNode,
  attributes?: TraceItemResponseAttribute[],
  event?: EventTransaction
): boolean {
  const operationName = getTraceNodeAttribute(
    SpanFields.GEN_AI_OPERATION_NAME,
    node,
    event,
    attributes
  );
  return (
    typeof operationName === 'string' && EVALUATION_OPERATION_NAMES.has(operationName)
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
  return answers.flatMap((answer): Array<[string, string]> => {
    const label = getAnswerLabel(answer, findQuestion(questions, answer.key));
    return label === null ? [] : [[answer.key, label]];
  });
}

/**
 * One-line result, e.g. `authIssue: Yes, urgency: high (1.6)`.
 */
export function getEvaluationPreview(evaluation: Evaluation | undefined): string {
  return getAnswerLabels(evaluation?.answers ?? [], evaluation?.input?.questions)
    .map(([key, label]) => `${key}: ${label}`)
    .join(', ');
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
    case 'refusal':
      return t('Refused');
    default:
      return null;
  }
}
