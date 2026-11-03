import {Fragment, useMemo} from 'react';

import {EntryErrorBoundary} from 'sentry/components/events/entryErrorBoundary';
import {Exception} from 'sentry/components/events/interfaces/exception';
import {StackTrace} from 'sentry/components/events/interfaces/stackTrace';
import {Threads} from 'sentry/components/events/interfaces/threads';
import {IssueStackTrace} from 'sentry/components/stackTrace/issueStackTrace';
import {getOrderedExceptions} from 'sentry/components/stackTrace/issueStackTrace/utils';
import type {Event} from 'sentry/types/event';
import {EntryType} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils/defined';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import {isNativePlatform} from 'sentry/utils/platform';
import {
  getHangProfileData,
  MetricKitHangProfileSection,
} from 'sentry/views/issueDetails/metricKitHangProfileSection';

interface EventStackTraceProps {
  event: Event;
  group: Group;
  projectSlug: Project['slug'];
  /** Use a local initial section state instead of saved collapse preferences. */
  initialCollapse?: boolean;
}

function getEventStackTraceData(event: Event, group: Group) {
  const shouldUseNewStackTrace = !isNativePlatform(event.platform);
  const issueTypeConfig = getConfigForIssueType(group, group.project);
  const threads = event.entries.findLast(entry => entry.type === EntryType.THREADS);
  let exception = event.entries.findLast(entry => entry.type === EntryType.EXCEPTION);
  let stacktrace = event.entries.findLast(entry => entry.type === EntryType.STACKTRACE);
  const mechanism = event.tags?.find(({key}) => key === 'mechanism')?.value;
  const hangProfileData =
    mechanism === 'mx_hang_diagnostic' ? getHangProfileData(event) : null;

  if (
    shouldUseNewStackTrace &&
    exception &&
    !getOrderedExceptions(exception.data.values ?? [], false, 'app').length
  ) {
    exception = undefined;
  }
  if (
    !issueTypeConfig.stacktrace.enabled ||
    (shouldUseNewStackTrace && !stacktrace?.data.frames?.length)
  ) {
    stacktrace = undefined;
  }

  return {exception, stacktrace, threads, hangProfileData, shouldUseNewStackTrace};
}

export function hasEventStackTrace(event: Event, group: Group): boolean {
  const {exception, stacktrace, threads, hangProfileData} = getEventStackTraceData(
    event,
    group
  );
  return Boolean(hangProfileData || exception || stacktrace || threads);
}

export function EventStackTrace({
  event,
  group,
  projectSlug,
  initialCollapse,
}: EventStackTraceProps) {
  const {exception, stacktrace, threads, hangProfileData, shouldUseNewStackTrace} =
    useMemo(() => getEventStackTraceData(event, group), [event, group]);
  const groupingCurrentLevel = group?.metadata?.current_level;

  if (hangProfileData) {
    return (
      <MetricKitHangProfileSection
        data={hangProfileData}
        initialCollapse={initialCollapse}
      />
    );
  }

  return (
    <Fragment>
      {defined(exception) && (
        <EntryErrorBoundary type={EntryType.EXCEPTION}>
          {shouldUseNewStackTrace ? (
            <IssueStackTrace
              initialCollapse={initialCollapse}
              event={event}
              values={exception.data.values ?? []}
              projectSlug={projectSlug}
              group={group}
            />
          ) : (
            <Exception
              initialCollapse={initialCollapse}
              event={event}
              data={exception.data}
              projectSlug={projectSlug}
              group={group}
              groupingCurrentLevel={groupingCurrentLevel}
            />
          )}
        </EntryErrorBoundary>
      )}
      {defined(stacktrace) && (
        <EntryErrorBoundary type={EntryType.STACKTRACE}>
          {shouldUseNewStackTrace ? (
            <IssueStackTrace
              initialCollapse={initialCollapse}
              event={event}
              stacktrace={stacktrace.data}
              projectSlug={projectSlug}
              group={group}
            />
          ) : (
            <StackTrace
              initialCollapse={initialCollapse}
              event={event}
              data={stacktrace.data}
              projectSlug={projectSlug}
              groupingCurrentLevel={groupingCurrentLevel}
            />
          )}
        </EntryErrorBoundary>
      )}
      {defined(threads) && (
        <EntryErrorBoundary type={EntryType.THREADS}>
          <Threads
            initialCollapse={initialCollapse}
            event={event}
            data={threads.data}
            projectSlug={projectSlug}
            groupingCurrentLevel={groupingCurrentLevel}
            group={group}
          />
        </EntryErrorBoundary>
      )}
    </Fragment>
  );
}
