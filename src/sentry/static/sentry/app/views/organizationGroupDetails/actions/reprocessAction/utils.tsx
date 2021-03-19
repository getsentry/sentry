import {ExceptionValue, PlatformType} from 'app/types';
import {EntryException, EntryType, Event} from 'app/types/event';
import {Thread} from 'app/types/events';
import {StacktraceType} from 'app/types/stacktrace';

const NATIVE_PLATFORMS = ['cocoa', 'native'] as Array<PlatformType>;

// Finds all frames in a given data blob and returns it's platforms
function getPlatforms(exceptionValue: ExceptionValue | StacktraceType) {
  const frames = exceptionValue?.frames ?? [];
  const stacktraceFrames = (exceptionValue as ExceptionValue)?.stacktrace?.frames ?? [];

  if (!frames.length && !stacktraceFrames.length) {
    return [];
  }

  return [...frames, ...stacktraceFrames]
    .map(frame => frame.platform)
    .filter(platform => !!platform);
}

function getStackTracePlatforms(event: Event, exceptionEntry: EntryException) {
  // Fetch platforms in stack traces of an exception entry
  const exceptionEntryPlatforms = (exceptionEntry.data.values ?? []).flatMap(
    getPlatforms
  );

  // Fetch platforms in an exception entry
  const stackTraceEntry = (event.entries.find(
    entry => entry.type === EntryType.STACKTRACE
  )?.data ?? {}) as StacktraceType;

  // Fetch platforms in an exception entry
  const stackTraceEntryPlatforms = Object.keys(stackTraceEntry).flatMap(key =>
    getPlatforms(stackTraceEntry[key])
  );

  // Fetch platforms in an thread entry
  const threadEntry = (event.entries.find(entry => entry.type === EntryType.THREADS)?.data
    .values ?? []) as Array<Thread>;

  // Fetch platforms in a thread entry
  const threadEntryPlatforms = threadEntry.flatMap(({stacktrace}) =>
    getPlatforms(stacktrace)
  );

  return new Set([
    ...exceptionEntryPlatforms,
    ...stackTraceEntryPlatforms,
    ...threadEntryPlatforms,
  ]);
}

// Checks whether an event indicates that it has an apple crash report.
export function isNativeEvent(event: Event, exceptionEntry: EntryException) {
  const {platform} = event;

  if (platform && NATIVE_PLATFORMS.includes(platform)) {
    return true;
  }

  const stackTracePlatforms = getStackTracePlatforms(event, exceptionEntry);

  return NATIVE_PLATFORMS.some(nativePlatform => stackTracePlatforms.has(nativePlatform));
}

//  Checks whether an event indicates that it has an associated minidump.
export function isMinidumpEvent(exceptionEntry: EntryException) {
  const {data} = exceptionEntry;
  return (data.values ?? []).some(value => value.mechanism?.type === 'minidump');
}

// Checks whether an event indicates that it has an apple crash report.
export function isAppleCrashReportEvent(exceptionEntry: EntryException) {
  const {data} = exceptionEntry;
  return (data.values ?? []).some(value => value.mechanism?.type === 'applecrashreport');
}
