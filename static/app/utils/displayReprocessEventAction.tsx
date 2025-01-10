import type {EntryException, Event, ExceptionValue, Thread} from 'sentry/types/event';
import {EntryType} from 'sentry/types/event';
import type {PlatformKey} from 'sentry/types/project';
import type {StacktraceType} from 'sentry/types/stacktrace';

/** All platforms that always use Debug Files. */
const DEBUG_FILE_PLATFORMS: Set<PlatformKey> = new Set([
  'objc',
  'cocoa',
  'swift',
  'native',
  'c',
]);
/** Other platforms that may use Debug Files. */
const MAYBE_DEBUG_FILE_PLATFORMS: Set<PlatformKey> = new Set(['csharp', 'java']);

/**
 * Returns whether to display the "Reprocess Event" action.
 *
 * That is the case when we have a "reprocessable" event, which is an event that needs
 * Debug Files for proper processing, as those Debug Files could have been uploaded *after*
 * the Event was ingested.
 */
export function displayReprocessEventAction(event: Event | null): boolean {
  if (!event) {
    return false;
  }

  const eventPlatforms = getEventPlatform(event);
  // Check Events from platforms that always use Debug Files as a fast-path
  if (hasIntersection(eventPlatforms, DEBUG_FILE_PLATFORMS)) {
    return true;
  }

  const hasDebugImages = (event?.entries ?? []).some(
    entry => entry.type === EntryType.DEBUGMETA && entry.data.images.length > 0
  );

  // Otherwise, check alternative platforms if they actually have Debug Files
  if (hasIntersection(eventPlatforms, MAYBE_DEBUG_FILE_PLATFORMS) && hasDebugImages) {
    return true;
  }

  // Finally, fall back to checking the `platform` of each frame
  const exceptionEntry = event.entries.find(
    entry => entry.type === EntryType.EXCEPTION
  ) as EntryException | undefined;

  if (!exceptionEntry) {
    return false;
  }

  return hasIntersection(
    getStackTracePlatforms(event, exceptionEntry),
    DEBUG_FILE_PLATFORMS
  );
}

/**
 * Returns whether the two Sets have intersecting elements.
 */
function hasIntersection<T>(set1: Set<T>, set2: Set<T>): boolean {
  for (const v of set1) {
    if (set2.has(v)) {
      return true;
    }
  }
  return false;
}

/**
 * Returns the event platform as a Set.
 */
function getEventPlatform(event: Event): Set<PlatformKey> {
  const platforms = new Set<PlatformKey>();
  addPlatforms(platforms, [event]);
  return platforms;
}

/**
 * Returns a Set of all platforms found in the `event` and `exceptionEntry`.
 */
function getStackTracePlatforms(
  event: Event,
  exceptionEntry: EntryException
): Set<PlatformKey> {
  const platforms = new Set<PlatformKey>();

  // Add platforms in stack traces of an exception entry
  (exceptionEntry.data.values ?? []).forEach(exc => addFramePlatforms(platforms, exc));

  // Add platforms in a stack trace entry
  const stackTraceEntry = (event.entries.find(
    entry => entry.type === EntryType.STACKTRACE
  )?.data ?? {}) as StacktraceType;

  Object.keys(stackTraceEntry).forEach(key =>
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    addFramePlatforms(platforms, stackTraceEntry[key])
  );

  // Add platforms in a thread entry
  const threadEntry = (event.entries.find(entry => entry.type === EntryType.THREADS)?.data
    .values ?? []) as Array<Thread>;

  threadEntry.forEach(({stacktrace}) => addFramePlatforms(platforms, stacktrace));

  return platforms;
}

/**
 * Adds all the platforms in the frames of `exceptionValue` to the `platforms` Set.
 */
function addFramePlatforms(
  platforms: Set<PlatformKey>,
  exceptionValue: ExceptionValue | StacktraceType | null
) {
  const frames = exceptionValue?.frames ?? [];
  const stacktraceFrames = (exceptionValue as ExceptionValue)?.stacktrace?.frames ?? [];

  addPlatforms(platforms, frames);
  addPlatforms(platforms, stacktraceFrames);
}

/**
 * Adds all the `platform` properties found in `iter` to the `platforms` Set.
 */
function addPlatforms(
  platforms: Set<PlatformKey>,
  iter: Array<{platform?: PlatformKey | null}>
) {
  for (const o of iter) {
    if (o.platform) {
      platforms.add(o.platform);
    }
  }
}
