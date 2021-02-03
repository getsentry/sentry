import {ExceptionValue, PlatformType} from 'app/types';
import {EntryException, EntryType, Event} from 'app/types/event';
import {Thread} from 'app/types/events';
import {StacktraceType} from 'app/types/stacktrace';

// Finds all stracktraces in a given data blob and returns it
// together with some meta information.
// Raw stacktraces are not included and stacktraces of the exception are not always included.
export function getPlatforms(exceptionValue: ExceptionValue | StacktraceType) {
  const frames = exceptionValue.frames ?? [];
  const stacktraceFrames = (exceptionValue as ExceptionValue)?.stacktrace?.frames ?? [];

  if (!frames.length && !stacktraceFrames.length) {
    return [];
  }

  return [...frames, ...stacktraceFrames]
    .map(frame => frame.platform)
    .filter(platform => !!platform) as Array<PlatformType>;
}

//     if not is_exception and (not stacktrace or not get_path(stacktrace, "frames", filter=True)):
//     return
// platforms = set(
//     frame.get("platform") or data.get("platform")
//     for frame in get_path(stacktrace, "frames", filter=True, default=())
// )
// rv.append(
//     StacktraceInfo(
//         stacktrace=stacktrace,
//         container=container,
//         platforms=platforms,
//         is_exception=is_exception,
//     )
// )

// Checks whether an event indicates that it has an apple crash report.
export function isNativeEvent(event: Event, exceptionEntry: EntryException) {
  const {platform} = event;

  // if (platform === 'cocoa' || platform === 'native') {
  //   return true;
  // }

  // Fetch platforms in stack traces of an exception entry
  const exceptionEntryStackTraces = (exceptionEntry.data.values ?? []).map(value => {
    const platforms: Array<PlatformType> = getPlatforms(value) ?? [event.platform];
    return {...value, platforms};
  });

  // Fetch platforms in an exception entry
  const stackTraceEntry = event.entries.find(entry => entry.type === EntryType.STACKTRACE)
    ?.data as StacktraceType;

  // Fetch platforms in an exception entry
  const stackTraceEntryStackTraces = Object.keys(stackTraceEntry ?? {}).map(key => {
    const stacktrace = stackTraceEntry[key];
    const platforms: Array<PlatformType> = getPlatforms(stacktrace) ?? [event.platform];
    return {...stacktrace, platforms};
  });

  // Fetch platforms in an thread entry
  const threadEntry = event.entries.find(entry => entry.type === EntryType.THREADS)?.data
    .values;

  // Fetch platforms in a thread entry
  const threadEntryStackTraces = ((threadEntry ?? []) as Array<Thread>).map(
    ({stacktrace}) => {
      const platforms: Array<PlatformType> = getPlatforms(stacktrace) ?? [event.platform];
      return {...stacktrace, platforms};
    }
  );

  return true;
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
