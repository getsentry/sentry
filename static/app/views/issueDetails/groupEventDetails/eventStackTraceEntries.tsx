import {Fragment} from 'react';

import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {EventDataSection} from 'sentry/components/events/eventDataSection';
import {Exception} from 'sentry/components/events/interfaces/exception';
import {StackTrace} from 'sentry/components/events/interfaces/stackTrace';
import {Threads} from 'sentry/components/events/interfaces/threads';
import {IssueStackTrace} from 'sentry/components/stackTrace/issueStackTrace';
import {t} from 'sentry/locale';
import type {Entry, EntryMap, Event} from 'sentry/types/event';
import {EntryType} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils/defined';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import {isNativePlatform} from 'sentry/utils/platform';

interface EventStackTraceEntriesProps {
  event: Event;
  group: Group;
  project: Project;
}

export function getEventEntryMap(event: Event): Partial<EntryMap> {
  return event.entries.reduce<Partial<EntryMap>>((entryMap, entry) => {
    (entryMap as Record<string, Entry>)[entry.type] = entry;
    return entryMap;
  }, {});
}

/**
 * Renders the exception, stack trace, and threads entries of an event.
 */
export function EventStackTraceEntries({
  event,
  group,
  project,
}: EventStackTraceEntriesProps) {
  const eventEntries = getEventEntryMap(event);
  // New stack trace is currently only non-native platforms.
  const shouldUseNewStackTrace = !isNativePlatform(event.platform);
  const groupingCurrentLevel = group?.metadata?.current_level;
  const issueTypeConfig = getConfigForIssueType(group, group.project);

  return (
    <Fragment>
      {defined(eventEntries[EntryType.EXCEPTION]) && (
        <EntryErrorBoundary type={EntryType.EXCEPTION}>
          {shouldUseNewStackTrace ? (
            <IssueStackTrace
              event={event}
              values={eventEntries[EntryType.EXCEPTION].data.values ?? []}
              projectSlug={project.slug}
              group={group}
            />
          ) : (
            <Exception
              event={event}
              data={eventEntries[EntryType.EXCEPTION].data}
              projectSlug={project.slug}
              group={group}
              groupingCurrentLevel={groupingCurrentLevel}
            />
          )}
        </EntryErrorBoundary>
      )}
      {issueTypeConfig.stacktrace.enabled &&
        defined(eventEntries[EntryType.STACKTRACE]) && (
          <EntryErrorBoundary type={EntryType.STACKTRACE}>
            {shouldUseNewStackTrace ? (
              <IssueStackTrace
                event={event}
                stacktrace={eventEntries[EntryType.STACKTRACE].data}
                projectSlug={project.slug}
                group={group}
              />
            ) : (
              <StackTrace
                event={event}
                data={eventEntries[EntryType.STACKTRACE].data}
                projectSlug={project.slug}
                groupingCurrentLevel={groupingCurrentLevel}
              />
            )}
          </EntryErrorBoundary>
        )}
      {defined(eventEntries[EntryType.THREADS]) && (
        <EntryErrorBoundary type={EntryType.THREADS}>
          <Threads
            event={event}
            data={eventEntries[EntryType.THREADS].data}
            projectSlug={project.slug}
            groupingCurrentLevel={groupingCurrentLevel}
            group={group}
          />
        </EntryErrorBoundary>
      )}
    </Fragment>
  );
}

/**
 * The FoldSection by default wraps its children with an ErrorBoundary, preventing content
 * from crashing the whole page if an error occurs, but EventDataSection does not do this.
 */
export function EntryErrorBoundary({
  children,
  type,
}: {
  children: React.ReactNode;
  type: EntryType;
}) {
  return (
    <ErrorBoundary
      customComponent={() => (
        <EventDataSection type={type} title={type}>
          <p>{t('There was an error rendering this data.')}</p>
        </EventDataSection>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}
