import {displayRawContent as rawStacktraceContent} from 'sentry/components/events/interfaces/crashContent/stackTrace/rawContent';
import type {StackTraceView} from 'sentry/components/stackTrace/types';
import type {Event, ExceptionValue} from 'sentry/types/event';
import {EntryType} from 'sentry/types/event';
import type {StacktraceType} from 'sentry/types/stacktrace';

interface IndexedExceptionValue extends ExceptionValue {
  exceptionIndex: number;
  stacktrace: StacktraceType;
}

/**
 * Falls back to symbolicated fields when the raw variant is missing.
 */
export function resolveExceptionFields(exc: IndexedExceptionValue, isMinified: boolean) {
  return {
    type: isMinified ? (exc.rawType ?? exc.type) : exc.type,
    module: isMinified ? (exc.rawModule ?? exc.module) : exc.module,
    value: isMinified ? (exc.rawValue ?? exc.value) : exc.value,
  };
}

/**
 * Raw view preserves original order so chained tracebacks read top-down.
 */
export function getOrderedExceptions(
  values: ExceptionValue[],
  isNewestFirst: boolean,
  view: StackTraceView
): IndexedExceptionValue[] {
  const indexed = values
    .map((exc, exceptionIndex) => ({...exc, exceptionIndex}))
    .filter((exc): exc is IndexedExceptionValue => exc.stacktrace !== null);
  return isNewestFirst && view !== 'raw' ? indexed.reverse() : indexed;
}

/**
 * Looks up the _meta entry for the exception or stacktrace.
 */
export function getExceptionEntryMeta(event: Event, isStandalone: boolean) {
  const entryType = isStandalone ? EntryType.STACKTRACE : EntryType.EXCEPTION;
  const entryIndex = event.entries?.findIndex(entry => entry.type === entryType);
  const rawEntryMeta = event._meta?.entries?.[entryIndex ?? -1]?.data;
  const exceptionValuesMeta = isStandalone ? undefined : rawEntryMeta?.values;
  return {rawEntryMeta, exceptionValuesMeta};
}

/**
 * Shared between the raw view and the copy-as-text output.
 */
export function formatExceptionsAsText({
  exceptions,
  platform,
  isMinified,
  isStandalone,
}: {
  exceptions: ExceptionValue[];
  isMinified: boolean;
  isStandalone: boolean;
  platform: Event['platform'];
}): string {
  return exceptions
    .map(exc =>
      rawStacktraceContent({
        data: isMinified ? (exc.rawStacktrace ?? exc.stacktrace) : exc.stacktrace,
        platform,
        exception: isStandalone ? undefined : exc,
        isMinified,
      })
    )
    .join('\n\n');
}
