/**
 * Parsing for `gen_ai` memory spans. Memory client SDKs record the targeted
 * store, an optional search query, and the records written or retrieved on
 * `gen_ai.memory.*` attributes. The specific operation is carried on
 * `gen_ai.operation.name`, which is also how a memory span is recognized.
 */

import round from 'lodash/round';
import {z} from 'zod';

import {t, tn} from 'sentry/locale';
import type {EventTransaction} from 'sentry/types/event';
import type {TraceItemResponseAttribute} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {getTraceNodeAttribute} from 'sentry/views/insights/pages/agents/utils/aiTraceNodes';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';
import {SpanFields} from 'sentry/views/insights/types';

/**
 * Well-known `gen_ai.operation.name` values for memory operations.
 */
export const MemoryOperation = {
  SEARCH: 'search_memory',
  CREATE: 'create_memory',
  UPSERT: 'upsert_memory',
  UPDATE: 'update_memory',
  DELETE: 'delete_memory',
  CREATE_STORE: 'create_memory_store',
  DELETE_STORE: 'delete_memory_store',
} as const;

const MEMORY_OPERATION_NAMES: ReadonlySet<string> = new Set(
  Object.values(MemoryOperation)
);

export function isMemoryOperation(
  operationName: string | undefined
): operationName is string {
  return operationName !== undefined && MEMORY_OPERATION_NAMES.has(operationName);
}

/**
 * Whether a span is a memory operation, from its `gen_ai.operation.name`.
 */
export function isMemoryNode(
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
  return typeof operationName === 'string' && isMemoryOperation(operationName);
}

/**
 * A single memory record following the OTel MemoryRecord schema. `content` may
 * be a string or an arbitrary object, so it's kept as sent.
 */
const memoryRecordSchema = z.object({
  content: z.unknown(),
  id: z.string().optional(),
  metadata: z.unknown().optional(),
  score: z.number().optional(),
});

export type MemoryRecord = z.infer<typeof memoryRecordSchema>;

export interface Memory {
  operation: string | undefined;
  query: string | undefined;
  /** The unparsed `gen_ai.memory.records` value, for a raw fallback view. */
  rawRecords: string | undefined;
  recordCount: number | undefined;
  recordId: string | undefined;
  /** Null when `gen_ai.memory.records` is absent or can't be parsed. */
  records: MemoryRecord[] | null;
  storeId: string | undefined;
}

/**
 * Parses `gen_ai.memory.records` into records, or null when it isn't a parseable
 * JSON array. An element that isn't a record object is kept whole as `content`
 * so nothing is silently dropped.
 */
function parseMemoryRecords(raw: unknown): MemoryRecord[] | null {
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
  return items.map((item): MemoryRecord => {
    const result = memoryRecordSchema.safeParse(item);
    return result.success && result.data.content !== undefined
      ? result.data
      : {content: item};
  });
}

/**
 * Reads the memory operation recorded on a memory span, or null for any other
 * span. Parts that can't be read are left undefined/null so callers can degrade
 * to a count-only view when records or the query weren't captured (both are
 * opt-in).
 */
export function getNodeMemory(
  node: AITraceSpanNode,
  attributes?: TraceItemResponseAttribute[],
  event?: EventTransaction
): Memory | null {
  if (!isMemoryNode(node, attributes, event)) {
    return null;
  }

  const str = (field: SpanFields): string | undefined => {
    const value = getTraceNodeAttribute(field, node, event, attributes);
    return typeof value === 'string' ? value : undefined;
  };

  const recordCountValue = getTraceNodeAttribute(
    SpanFields.GEN_AI_MEMORY_RECORD_COUNT,
    node,
    event,
    attributes
  );
  const recordCount =
    typeof recordCountValue === 'number'
      ? recordCountValue
      : typeof recordCountValue === 'string' && recordCountValue !== ''
        ? Number(recordCountValue)
        : undefined;

  const rawRecords = str(SpanFields.GEN_AI_MEMORY_RECORDS);

  return {
    operation: str(SpanFields.GEN_AI_OPERATION_NAME),
    query: str(SpanFields.GEN_AI_MEMORY_QUERY_TEXT),
    records: parseMemoryRecords(rawRecords),
    recordCount:
      recordCount !== undefined && Number.isFinite(recordCount) ? recordCount : undefined,
    recordId: str(SpanFields.GEN_AI_MEMORY_RECORD_ID),
    storeId: str(SpanFields.GEN_AI_MEMORY_STORE_ID),
    rawRecords,
  };
}

/**
 * The result summary shown in a write operation's Output tab, e.g.
 * `3 records created`.
 */
export function getMemoryResultText(memory: Memory): string | undefined {
  const count = memory.recordCount;
  switch (memory.operation) {
    case MemoryOperation.CREATE:
      return count === undefined
        ? undefined
        : tn('%s record created', '%s records created', count);
    case MemoryOperation.UPSERT:
      // Upsert can create or update, so stay neutral about which happened.
      return count === undefined
        ? undefined
        : tn('%s record written', '%s records written', count);
    case MemoryOperation.UPDATE:
      return count === undefined
        ? undefined
        : tn('%s record updated', '%s records updated', count);
    case MemoryOperation.DELETE:
      if (count === undefined) {
        return memory.recordId ? t('Deleted record %s', memory.recordId) : undefined;
      }
      return tn('%s record deleted', '%s records deleted', count);
    default:
      return undefined;
  }
}

export function formatMemoryScore(score: number): string {
  return String(round(score, 2));
}
