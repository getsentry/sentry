import {Fragment} from 'react';

import {partitionEntriesForReplay} from 'sentry/components/events/eventEntries';
import {EventEntry} from 'sentry/components/events/eventEntry';
import {EntryType, type EventTransaction} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';

export function Entries({
  definedEvent,
  projectSlug,
  group,
  organization,
}: {
  definedEvent: EventTransaction;
  group: Group | undefined;
  organization: Organization;
  projectSlug: string;
}) {
  if (!Array.isArray(definedEvent.entries) || !definedEvent.projectSlug) {
    return null;
  }

  const [_, afterReplayEntries] = partitionEntriesForReplay(definedEvent.entries);

  const eventEntryProps = {
    projectSlug,
    group,
    organization,
    event: definedEvent,
    isShare: true,
  };

  return (
    <Fragment>
      {afterReplayEntries!.map((entry, entryIdx) => {
        // Breadcrumbs and request entries are rendered separately in the drawer.
        if (entry.type === EntryType.BREADCRUMBS || entry.type === EntryType.REQUEST) {
          return null;
        }

        return <EventEntry key={entryIdx} entry={entry} {...eventEntryProps} />;
      })}
    </Fragment>
  );
}
