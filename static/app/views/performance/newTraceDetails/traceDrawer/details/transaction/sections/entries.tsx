import {Fragment} from 'react';

import ErrorBoundary from 'sentry/components/errorBoundary';
import {Csp} from 'sentry/components/events/interfaces/csp';
import {Exception} from 'sentry/components/events/interfaces/exception';
import {Generic} from 'sentry/components/events/interfaces/generic';
import {Message} from 'sentry/components/events/interfaces/message';
import {StackTrace} from 'sentry/components/events/interfaces/stackTrace';
import {Template} from 'sentry/components/events/interfaces/template';
import {Threads} from 'sentry/components/events/interfaces/threads';
import {t} from 'sentry/locale';
import {
  EntryType,
  type Entry,
  type Event,
  type EventTransaction,
} from 'sentry/types/event';
import type {Project} from 'sentry/types/project';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';

type EventEntryContentProps = {
  entry: Entry;
  event: Event;
  projectSlug: Project['slug'];
};

function EventEntryContent({entry, projectSlug, event}: EventEntryContentProps) {
  switch (entry.type) {
    case EntryType.EXCEPTION:
      return (
        <Exception
          event={event}
          group={undefined}
          data={entry.data}
          projectSlug={projectSlug}
          groupingCurrentLevel={undefined}
        />
      );

    case EntryType.MESSAGE:
      return <Message event={event} data={entry.data} />;

    case EntryType.STACKTRACE:
      return (
        <StackTrace
          event={event}
          data={entry.data}
          projectSlug={projectSlug}
          groupingCurrentLevel={undefined}
        />
      );

    case EntryType.TEMPLATE:
      return <Template event={event} data={entry.data} />;

    case EntryType.CSP:
      return <Csp event={event} data={entry.data} />;

    case EntryType.EXPECTCT:
    case EntryType.EXPECTSTAPLE: {
      const {data, type} = entry;
      return <Generic type={type} data={data} />;
    }
    case EntryType.HPKP:
      return (
        <Generic type={entry.type} data={entry.data} meta={event._meta?.hpkp ?? {}} />
      );

    case EntryType.THREADS:
      return (
        <Threads
          event={event}
          group={undefined}
          data={entry.data}
          projectSlug={projectSlug}
          groupingCurrentLevel={undefined}
        />
      );

    case EntryType.BREADCRUMBS:
    case EntryType.REQUEST:
    case EntryType.DEBUGMETA:
    case EntryType.SPANS:
      return null;
    // this should not happen
    default:
      if (window.console) {
        // eslint-disable-next-line no-console
        console.error?.('Unregistered interface: ' + (entry as any).type);
      }
      return null;
  }
}

export function Entries({
  definedEvent,
  projectSlug,
}: {
  definedEvent: EventTransaction;
  projectSlug: string;
}) {
  if (!Array.isArray(definedEvent.entries) || !definedEvent.projectSlug) {
    return null;
  }

  const [_, afterReplayEntries] = partitionEntriesForReplay(definedEvent.entries);

  return (
    <Fragment>
      {afterReplayEntries!.map((entry, entryIdx) => {
        return (
          <ErrorBoundary
            key={entryIdx}
            customComponent={() => (
              <InterimSection type={entry.type} title={entry.type}>
                <p>{t('There was an error rendering this data.')}</p>
              </InterimSection>
            )}
          >
            <EventEntryContent
              entry={entry}
              projectSlug={projectSlug}
              event={definedEvent}
            />
          </ErrorBoundary>
        );
      })}
    </Fragment>
  );
}

// The ordering for event entries is owned by the interface serializers on the backend.
// Because replays are not an interface, we need to manually insert the replay section
// into the array of entries. The long-term solution here is to move the ordering
// logic to this component, similar to how GroupEventDetailsContent works.
function partitionEntriesForReplay(entries: Entry[]) {
  let replayIndex = 0;

  for (const [i, entry] of entries.entries()) {
    if (
      [
        // The following entry types should be placed before the replay
        // This is similar to the ordering in GroupEventDetailsContent
        EntryType.MESSAGE,
        EntryType.STACKTRACE,
        EntryType.EXCEPTION,
        EntryType.THREADS,
        EntryType.SPANS,
      ].includes(entry.type)
    ) {
      replayIndex = i + 1;
    }
  }

  return [entries.slice(0, replayIndex), entries.slice(replayIndex)];
}
