import {displayRawContent as rawStacktraceContent} from 'sentry/components/events/interfaces/crashContent/stackTrace/rawContent';
import {getStacktracePlatform} from 'sentry/components/events/interfaces/utils';
import type {StackTraceView} from 'sentry/components/stackTrace/types';
import type {Event, ExceptionValue} from 'sentry/types/event';
import {EntryType} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import type {PlatformKey} from 'sentry/types/platform';
import type {StacktraceType} from 'sentry/types/stacktrace';

interface IndexedExceptionValue extends ExceptionValue {
  exceptionIndex: number;
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
    .filter(exc => exc.stacktrace || exc.type || exc.value);
  return isNewestFirst && view !== 'raw' ? indexed.reverse() : indexed;
}

export function getFirstVisibleStacktraceIndex(
  exceptions: ExceptionValue[],
  isMinified: boolean,
  hiddenExceptions: Record<number, boolean>
): number {
  return exceptions.findIndex(exc => {
    if (
      !exc.stacktrace ||
      (exc.mechanism?.parent_id !== undefined &&
        hiddenExceptions[exc.mechanism.parent_id])
    ) {
      return false;
    }

    const stacktrace = isMinified
      ? (exc.rawStacktrace ?? exc.stacktrace)
      : exc.stacktrace;
    return (stacktrace.frames?.length ?? 0) > 0;
  });
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
 * Picks the platform a stack trace renders with. Frame platforms only take
 * over with the native stack trace, which renders native frames found in
 * non-native events. Without it, the event platform wins.
 */
export function getIssueStackTracePlatform(
  organization: Organization,
  event: Event,
  stacktrace: StacktraceType | null | undefined
): PlatformKey {
  const stacktracePlatform = getStacktracePlatform(event, stacktrace);
  if (organization.features.includes('issue-details-native-stack-trace')) {
    return stacktracePlatform;
  }
  return event.platform ?? stacktracePlatform;
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
    .map(exc => {
      const data = isMinified ? (exc.rawStacktrace ?? exc.stacktrace) : exc.stacktrace;
      return rawStacktraceContent({
        data,
        // Mixed events (e.g. JavaScript threads in a native event) format by frame platform.
        platform: data?.frames?.[0]?.platform ?? platform,
        exception: isStandalone ? undefined : exc,
        isMinified,
      });
    })
    .join('\n\n');
}
