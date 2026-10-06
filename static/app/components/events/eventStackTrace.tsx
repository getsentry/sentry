import {Fragment, useMemo} from 'react';

import {EntryErrorBoundary} from 'sentry/components/events/entryErrorBoundary';
import {Exception} from 'sentry/components/events/interfaces/exception';
import {StackTrace} from 'sentry/components/events/interfaces/stackTrace';
import {Threads} from 'sentry/components/events/interfaces/threads';
import {IssueStackTrace} from 'sentry/components/stackTrace/issueStackTrace';
import type {
  Entry,
  EntryMap,
  EntryThreads,
  Event,
  ExceptionType,
  ExceptionValue,
} from 'sentry/types/event';
import {EntryType} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import type {StacktraceType} from 'sentry/types/stacktrace';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import {isNativePlatform} from 'sentry/utils/platform';
import {
  getHangProfileData,
  MetricKitHangProfileSection,
  type HangProfileData,
} from 'sentry/views/issueDetails/metricKitHangProfileSection';

interface EventStackTraceProps {
  event: Event;
  group: Group;
  projectSlug: Project['slug'];
}

type EventTrace =
  | {
      data: {values: ExceptionValue[]} | {stacktrace: StacktraceType};
      entryType: EntryType.EXCEPTION | EntryType.STACKTRACE;
      kind: 'issue';
    }
  | {data: ExceptionType; entryType: EntryType.EXCEPTION; kind: 'exception'}
  | {data: StacktraceType; entryType: EntryType.STACKTRACE; kind: 'stacktrace'}
  | {data: EntryThreads['data']; entryType: EntryType.THREADS; kind: 'threads'}
  | {data: HangProfileData; kind: 'hang'};

function useEventStackTrace({
  event,
  group,
}: Pick<EventStackTraceProps, 'event' | 'group'>): EventTrace[] {
  const isNative = isNativePlatform(event.platform);
  const eventEntries = useMemo(() => {
    return event.entries.reduce<Partial<EntryMap>>((entryMap, entry) => {
      (entryMap as Record<string, Entry>)[entry.type] = entry;
      return entryMap;
    }, {});
  }, [event]);
  const mechanism = event.tags?.find(({key}) => key === 'mechanism')?.value;
  const hangProfileData =
    mechanism === 'mx_hang_diagnostic' ? getHangProfileData(event) : null;
  const issueTypeConfig = getConfigForIssueType(group, group.project);

  if (hangProfileData) {
    return [{kind: 'hang', data: hangProfileData}];
  }

  const exception = eventEntries[EntryType.EXCEPTION];
  const stacktrace = eventEntries[EntryType.STACKTRACE];
  const threads = eventEntries[EntryType.THREADS];
  const traces: EventTrace[] = [];

  // Thread rendering includes its associated exception.
  if (exception && !threads) {
    traces.push(
      isNative
        ? {kind: 'exception', entryType: EntryType.EXCEPTION, data: exception.data}
        : {
            kind: 'issue',
            entryType: EntryType.EXCEPTION,
            data: {values: exception.data.values ?? []},
          }
    );
  }

  // Native standalone traces can coexist with threads; modern traces cannot.
  if (issueTypeConfig.stacktrace.enabled && stacktrace && (isNative || !threads)) {
    traces.push(
      isNative
        ? {kind: 'stacktrace', entryType: EntryType.STACKTRACE, data: stacktrace.data}
        : {
            kind: 'issue',
            entryType: EntryType.STACKTRACE,
            data: {stacktrace: stacktrace.data},
          }
    );
  }

  if (threads) {
    traces.push({kind: 'threads', entryType: EntryType.THREADS, data: threads.data});
  }

  return traces;
}

export function EventStackTrace(props: EventStackTraceProps) {
  const traces = useEventStackTrace(props);
  return (
    <Fragment>
      {traces.map(trace => {
        if (trace.kind === 'hang') {
          return <MetricKitHangProfileSection key="hang" data={trace.data} />;
        }
        return (
          <EntryErrorBoundary key={trace.entryType} type={trace.entryType}>
            <EventStackTraceContent {...props} trace={trace} />
          </EntryErrorBoundary>
        );
      })}
    </Fragment>
  );
}

function EventStackTraceContent({
  trace,
  ...props
}: EventStackTraceProps & {trace: Exclude<EventTrace, {kind: 'hang'}>}) {
  const groupingCurrentLevel = props.group.metadata?.current_level;
  switch (trace.kind) {
    case 'issue':
      return <IssueStackTrace {...props} {...trace.data} />;
    case 'exception':
      return (
        <Exception
          {...props}
          data={trace.data}
          groupingCurrentLevel={groupingCurrentLevel}
        />
      );
    case 'stacktrace':
      return (
        <StackTrace
          {...props}
          data={trace.data}
          groupingCurrentLevel={groupingCurrentLevel}
        />
      );
    case 'threads':
      return (
        <Threads
          {...props}
          data={trace.data}
          groupingCurrentLevel={groupingCurrentLevel}
        />
      );
  }
}
