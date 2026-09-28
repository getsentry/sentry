import {
  getSpanCategory,
  getSpanInfoFromTransactionEvent,
  getSpanSentryGroupValue,
} from 'sentry/components/events/interfaces/performance/utils';
import {getAttributeValue} from 'sentry/utils/fields/getAttributeValue';
import type {TraceItemDetailsResponse} from 'sentry/views/explore/hooks/useTraceItemDetails';

/** The evidence the slow-query pane needs, independent of its storage format. */
export interface SlowDBQuerySpan {
  category?: string;
  codeFilepath?: string;
  codeFunction?: string;
  codeLineNumber?: number;
  description?: string;
  durationMs?: number;
  group?: string;
  op?: string;
}

function getCodeLocation(attributes: Parameters<typeof getAttributeValue>[0]) {
  const codeLineNumber = getAttributeValue(attributes, 'code.line.number', 'number');

  return {
    codeFilepath: getAttributeValue(attributes, 'code.file.path', 'string'),
    codeFunction: getAttributeValue(attributes, 'code.function', 'string'),
    codeLineNumber: typeof codeLineNumber === 'number' ? codeLineNumber : undefined,
  };
}

export function slowDBQuerySpanFromTraceItem(
  item: TraceItemDetailsResponse
): SlowDBQuerySpan {
  const {attributes} = item;
  const durationMs = getAttributeValue(attributes, 'span.duration', 'number');

  return {
    ...getCodeLocation(attributes),
    description: getAttributeValue(attributes, 'span.description', 'string'),
    op: getAttributeValue(attributes, 'span.op', 'string'),
    group: getAttributeValue(attributes, 'span.group', 'string'),
    category: getAttributeValue(attributes, 'span.category', 'string'),
    durationMs:
      typeof durationMs === 'number' && durationMs >= 0 ? durationMs : undefined,
  };
}

/** Prefer usable dataset SQL, retaining a complete recorded snapshot on lookup gaps. */
export function resolveSlowDBQuerySpan(
  event: Parameters<typeof getSpanInfoFromTransactionEvent>[0],
  data?: TraceItemDetailsResponse
): SlowDBQuerySpan | undefined {
  if (data) {
    const span = slowDBQuerySpanFromTraceItem(data);
    if (span.description?.trim()) {
      return span;
    }

    // A removed query is not missing data: do not restore it from an older snapshot.
    if (data.meta?.['span.description']?.meta?.value?.['']?.rem?.length) {
      return undefined;
    }
  }

  const recorded = slowDBQuerySpanFromEvent(
    getSpanInfoFromTransactionEvent(event)?.offendingSpans[0]
  );
  return recorded?.description?.trim() ? recorded : undefined;
}

export function slowDBQuerySpanFromEvent(
  span:
    | {
        data?: Record<string, unknown>;
        description?: string;
        op?: string;
        sentry_tags?: Record<string, string>;
        start_timestamp?: number;
        timestamp?: number;
      }
    | undefined
): SlowDBQuerySpan | undefined {
  if (!span) {
    return undefined;
  }

  const durationMs =
    span.start_timestamp !== undefined && span.timestamp !== undefined
      ? (span.timestamp - span.start_timestamp) * 1000
      : undefined;

  return {
    ...getCodeLocation(span.data ?? {}),
    description: span.description,
    op: span.op,
    group: getSpanSentryGroupValue(span),
    category: getSpanCategory(span),
    durationMs: durationMs !== undefined && durationMs >= 0 ? durationMs : undefined,
  };
}
