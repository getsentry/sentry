import {Container} from '@sentry/scraps/layout';

import {Placeholder} from 'sentry/components/placeholder';
import {EntryType} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {StaticFoldSections} from 'sentry/views/issueDetails/foldSection';
import {EventStackTraceEntries} from 'sentry/views/issueDetails/groupEventDetails/eventStackTraceEntries';
import {useGroupEvent} from 'sentry/views/issueDetails/useGroupEvent';

const STACK_TRACE_ENTRY_TYPES = new Set<EntryType>([
  EntryType.EXCEPTION,
  EntryType.STACKTRACE,
  EntryType.THREADS,
]);

export function IssuePreviewStackTrace({
  group,
  project,
}: {
  group: Group;
  project: Project;
}) {
  const {data: event, isPending} = useGroupEvent({
    groupId: group.id,
    eventId: 'recommended',
  });

  if (isPending) {
    return <Placeholder height="120px" />;
  }

  if (!event?.entries.some(entry => STACK_TRACE_ENTRY_TYPES.has(entry.type))) {
    return null;
  }

  return (
    <Container>
      <StaticFoldSections>
        <EventStackTraceEntries event={event} group={group} project={project} />
      </StaticFoldSections>
    </Container>
  );
}
