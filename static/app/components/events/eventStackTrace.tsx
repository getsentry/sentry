import {Fragment, useMemo} from 'react';

import {EntryErrorBoundary} from 'sentry/components/events/entryErrorBoundary';
import {Exception} from 'sentry/components/events/interfaces/exception';
import {StackTrace} from 'sentry/components/events/interfaces/stackTrace';
import {Threads} from 'sentry/components/events/interfaces/threads';
import {IssueStackTrace} from 'sentry/components/stackTrace/issueStackTrace';
import {getOrderedExceptions} from 'sentry/components/stackTrace/issueStackTrace/utils';
import {IssueThreadStackTrace} from 'sentry/components/stackTrace/native/issueThreadStackTrace';
import type {Event} from 'sentry/types/event';
import {EntryType} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils/defined';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import {isNativePlatform} from 'sentry/utils/platform';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  getHangProfileData,
  MetricKitHangProfileSection,
} from 'sentry/views/issueDetails/metricKitHangProfileSection';

interface EventStackTraceProps {
  event: Event;
  group: Group;
  projectSlug: Project['slug'];
  collapseAll?: boolean;
}

function getEventStackTraceData(event: Event, group: Group, organization: Organization) {
  const isNativeEvent = isNativePlatform(event.platform);
  const hasNativeStackTrace = organization.features.includes(
    'issue-details-native-stack-trace'
  );
  const shouldUseNewStackTrace = !isNativeEvent || hasNativeStackTrace;
  const shouldUseNewNativeThreadStackTrace = isNativeEvent && hasNativeStackTrace;
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

  return {
    exception,
    stacktrace,
    threads,
    hangProfileData,
    shouldUseNewStackTrace,
    shouldUseNewNativeThreadStackTrace,
  };
}

export function hasEventStackTrace(
  event: Event,
  group: Group,
  organization: Organization
): boolean {
  const {exception, stacktrace, threads, hangProfileData} = getEventStackTraceData(
    event,
    group,
    organization
  );
  return Boolean(hangProfileData || exception || stacktrace || threads);
}

export function EventStackTrace({
  event,
  group,
  projectSlug,
  collapseAll,
}: EventStackTraceProps) {
  const organization = useOrganization();
  const {
    exception,
    stacktrace,
    threads,
    hangProfileData,
    shouldUseNewStackTrace,
    shouldUseNewNativeThreadStackTrace,
  } = useMemo(
    () => getEventStackTraceData(event, group, organization),
    [event, group, organization]
  );
  const groupingCurrentLevel = group?.metadata?.current_level;

  if (hangProfileData) {
    return <MetricKitHangProfileSection data={hangProfileData} />;
  }

  return (
    <Fragment>
      {defined(exception) && (
        <EntryErrorBoundary type={EntryType.EXCEPTION}>
          {shouldUseNewStackTrace ? (
            <IssueStackTrace
              collapseAll={collapseAll}
              event={event}
              values={exception.data.values ?? []}
              projectSlug={projectSlug}
              group={group}
            />
          ) : (
            <Exception
              collapseAll={collapseAll}
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
              collapseAll={collapseAll}
              event={event}
              stacktrace={stacktrace.data}
              projectSlug={projectSlug}
              group={group}
            />
          ) : (
            <StackTrace
              collapseAll={collapseAll}
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
          {shouldUseNewNativeThreadStackTrace ? (
            <IssueThreadStackTrace
              collapseAll={collapseAll}
              event={event}
              data={threads.data}
              projectSlug={projectSlug}
              groupingCurrentLevel={groupingCurrentLevel}
              group={group}
            />
          ) : (
            <Threads
              collapseAll={collapseAll}
              event={event}
              data={threads.data}
              projectSlug={projectSlug}
              groupingCurrentLevel={groupingCurrentLevel}
              group={group}
            />
          )}
        </EntryErrorBoundary>
      )}
    </Fragment>
  );
}
