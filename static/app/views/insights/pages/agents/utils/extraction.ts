/**
 * Parsing for extraction spans. Extractor SDKs record the source text and the
 * fields to pull out of it on `gen_ai.input.messages`, and the extracted values
 * on `gen_ai.output.messages`, as a single item rather than chat messages. The
 * span is recognized by its `gen_ai.operation.name` of `extract`.
 */

import {z} from 'zod';

import {t} from 'sentry/locale';
import type {EventTransaction} from 'sentry/types/event';
import type {TraceItemResponseAttribute} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {getTraceNodeAttribute} from 'sentry/views/insights/pages/agents/utils/aiTraceNodes';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';
import {SpanFields} from 'sentry/views/insights/types';

// As with evaluations, schemas describe the valid shape only and keep values as
// sent. A field or answer that's present with the wrong type is shown raw
// instead of silently dropping it.

// Matches anything, so it goes last in a union as the fallback.
const invalidEntrySchema = z
  .unknown()
  .transform(value => ({kind: 'invalid' as const, value}));

/** `[start, end)` character offsets into the source text. */
const offsetsSchema = z.tuple([z.number(), z.number()]);

const fieldSchema = z.union([
  z
    .object({
      /** e.g. `text`, `date`, `number` or `list`. */
      type: z.string(),
      instructions: z.string().optional(),
    })
    .transform(field => ({...field, kind: 'field' as const})),
  invalidEntrySchema,
]);

const answerSchema = z.union([
  z
    .object({
      type: z.string(),
      /** The normalized value, e.g. `"2026-10-02"` for "issued 2026-09-02, net 30". Null when not found. */
      value: z.unknown(),
      /** The value as it appears in the source text. */
      guess: z.unknown().optional(),
      confidence: z.number().optional(),
      /** Probability that the source text doesn't contain the field. */
      p_null: z.number().optional(),
      /** Where the value was found; `spans` for list fields with one per item. */
      span: offsetsSchema.optional(),
      spans: z.array(offsetsSchema).optional(),
    })
    .transform(({p_null, span, spans, ...answer}) => ({
      ...answer,
      kind: 'answer' as const,
      nullProbability: p_null,
      offsets: spans ?? (span ? [span] : []),
    })),
  invalidEntrySchema,
]);

type WithKey<T> = T & {key: string};

export type ExtractionField = WithKey<z.output<typeof fieldSchema>>;
export type ExtractionAnswer = WithKey<z.output<typeof answerSchema>>;
export type ExtractedValue = Extract<ExtractionAnswer, {kind: 'answer'}>;

export interface ExtractionInput {
  fields: ExtractionField[];
  /** The text the fields are extracted from. */
  source: string;
}

const inputItemSchema = z.object({
  // The source text is the core of the input, so it must be present.
  state: z.string(),
  fields: z.record(z.string(), fieldSchema).optional(),
});

const outputItemSchema = z.object({
  answers: z.record(z.string(), answerSchema),
});

/**
 * Parses a messages attribute and returns its first item matching `schema`.
 */
function findExtractionItem<T extends z.ZodType>(
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
 * Parses the source text and fields, or returns null when the message isn't an
 * extraction.
 */
export function parseExtractionInput(raw: unknown): ExtractionInput | null {
  const item = findExtractionItem(raw, inputItemSchema);
  if (!item) {
    return null;
  }
  return {
    source: item.state,
    fields: Object.entries(item.fields ?? {}).map(([key, field]): ExtractionField => ({
      key,
      ...field,
    })),
  };
}

/**
 * Parses the extracted values, or returns null when the message isn't an
 * extraction.
 */
export function parseExtractionOutput(raw: unknown): ExtractionAnswer[] | null {
  const item = findExtractionItem(raw, outputItemSchema);
  if (!item) {
    return null;
  }
  return Object.entries(item.answers).map(([key, answer]): ExtractionAnswer => ({
    key,
    ...answer,
  }));
}

/**
 * Whether a span is an extraction, from its `gen_ai.operation.name`.
 */
export function isExtractionNode(
  node: AITraceSpanNode,
  attributes?: TraceItemResponseAttribute[],
  event?: EventTransaction
): boolean {
  return (
    getTraceNodeAttribute(SpanFields.GEN_AI_OPERATION_NAME, node, event, attributes) ===
    'extract'
  );
}

export interface Extraction {
  /**
   * Null when the output isn't in the extraction format, e.g. it's malformed or
   * the call failed.
   */
  answers: ExtractionAnswer[] | null;
  /** Null when the input isn't in the extraction format. */
  input: ExtractionInput | null;
  rawInput: string | undefined;
  rawOutput: string | undefined;
}

/**
 * Reads the extraction recorded on an extraction span, or null for any other
 * span. Parts that can't be read are null, so callers can show them raw.
 */
export function getNodeExtraction(
  node: AITraceSpanNode,
  attributes?: TraceItemResponseAttribute[],
  event?: EventTransaction
): Extraction | null {
  if (!isExtractionNode(node, attributes, event)) {
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
    input: parseExtractionInput(rawInput),
    answers: parseExtractionOutput(rawOutput),
    rawInput: typeof rawInput === 'string' ? rawInput : undefined,
    rawOutput: typeof rawOutput === 'string' ? rawOutput : undefined,
  };
}

export interface ExtractionRow {
  key: string;
  /** The extracted value, unless the output is missing or omits this field. */
  answer?: ExtractionAnswer;
  /** The requested field, unless the input is missing or omits it. */
  field?: ExtractionField;
}

/**
 * One row per field, pairing its definition with its extracted value. Fields
 * keep their requested order; answers for fields that weren't requested follow.
 */
export function getExtractionRows(
  fields: ExtractionField[] | undefined,
  answers: ExtractionAnswer[] | null | undefined
): ExtractionRow[] {
  const answersByKey = new Map((answers ?? []).map(answer => [answer.key, answer]));
  const rows: ExtractionRow[] = (fields ?? []).map(field => ({
    key: field.key,
    field,
    answer: answersByKey.get(field.key),
  }));
  const fieldKeys = new Set(rows.map(row => row.key));
  for (const answer of answers ?? []) {
    if (!fieldKeys.has(answer.key)) {
      rows.push({key: answer.key, answer});
    }
  }
  return rows;
}

/**
 * Whether the model found a value for the field. A field it didn't find has a
 * null value.
 */
export function hasValue(answer: ExtractedValue): boolean {
  return answer.value !== null && answer.value !== undefined;
}

/**
 * Whether a value was found but not located in the source, i.e. the model
 * worked it out rather than copying it, e.g. a due date from "issued
 * 2026-09-02, net 30". Such values have nothing to highlight in the source.
 */
export function isInferredAnswer(answer: ExtractionAnswer | undefined): boolean {
  return answer?.kind === 'answer' && hasValue(answer) && answer.offsets.length === 0;
}

/**
 * A short text form of a single extracted value, e.g. "INV-2291" or "1080".
 */
export function formatExtractedValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'boolean') {
    return value ? t('Yes') : t('No');
  }
  if (typeof value === 'number' || typeof value === 'bigint') {
    return String(value);
  }
  return JSON.stringify(value);
}

/**
 * A short text form of an answer, e.g. "INV-2291" or "Dana Ruiz, Priya Shah".
 * Null for fields that weren't found and invalid answers.
 */
export function getExtractedValueLabel(answer: ExtractionAnswer): string | null {
  if (answer.kind !== 'answer' || !hasValue(answer)) {
    return null;
  }
  if (Array.isArray(answer.value)) {
    return answer.value.map(formatExtractedValue).join(', ');
  }
  return formatExtractedValue(answer.value);
}

/**
 * The key and label of each found value, e.g. `['invoice_number', 'INV-2291']`.
 */
export function getExtractedValueLabels(
  answers: ExtractionAnswer[]
): Array<[key: string, label: string]> {
  return answers.flatMap(answer => {
    const label = getExtractedValueLabel(answer);
    return label === null ? [] : [[answer.key, label]];
  });
}

/**
 * One-line result, e.g. `invoice_number: INV-2291, total: 1080`.
 */
export function getExtractionPreview(extraction: Extraction | undefined): string {
  return getExtractedValueLabels(extraction?.answers ?? [])
    .map(([key, label]) => `${key}: ${label}`)
    .join(', ');
}

export interface SourceSegment {
  text: string;
  /** The answer keys whose value was found in this part of the source. */
  keys?: string[];
}

/**
 * Splits the source text into plain and matched segments, so the values found
 * can be highlighted in place. Offsets outside the text are ignored; overlapping
 * matches are merged into one segment naming every key.
 */
export function getSourceSegments(
  source: string,
  answers: ExtractionAnswer[] | null | undefined
): SourceSegment[] {
  const ranges = (answers ?? [])
    .flatMap(answer =>
      // A field that wasn't found can still point at the candidate the model
      // rejected; that isn't a match, so it isn't highlighted.
      answer.kind === 'answer' && hasValue(answer)
        ? answer.offsets.map(([start, end]) => ({start, end, key: answer.key}))
        : []
    )
    .filter(
      ({start, end}) =>
        Number.isInteger(start) &&
        Number.isInteger(end) &&
        start >= 0 &&
        end <= source.length &&
        start < end
    )
    .sort((a, b) => a.start - b.start || b.end - a.end);

  const segments: SourceSegment[] = [];
  let cursor = 0;
  for (const range of ranges) {
    const last = segments.at(-1);
    if (range.start < cursor && last?.keys) {
      // Overlaps the previous match: extend it.
      if (range.end > cursor) {
        last.text += source.slice(cursor, range.end);
        cursor = range.end;
      }
      if (!last.keys.includes(range.key)) {
        last.keys.push(range.key);
      }
      continue;
    }
    if (range.start > cursor) {
      segments.push({text: source.slice(cursor, range.start)});
    }
    segments.push({text: source.slice(range.start, range.end), keys: [range.key]});
    cursor = range.end;
  }
  if (cursor < source.length) {
    segments.push({text: source.slice(cursor)});
  }
  return segments;
}
