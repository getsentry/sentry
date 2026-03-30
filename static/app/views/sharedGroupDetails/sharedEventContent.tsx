import {Container} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';

import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {EventDataSection} from 'sentry/components/events/eventDataSection';
import {EventEvidence} from 'sentry/components/events/eventEvidence';
import {Csp} from 'sentry/components/events/interfaces/csp';
import {Exception} from 'sentry/components/events/interfaces/exception';
import {Generic} from 'sentry/components/events/interfaces/generic';
import {Message} from 'sentry/components/events/interfaces/message';
import {Request} from 'sentry/components/events/interfaces/request';
import {StackTrace} from 'sentry/components/events/interfaces/stackTrace';
import {Template} from 'sentry/components/events/interfaces/template';
import {Threads} from 'sentry/components/events/interfaces/threads';
import {EventPackageData} from 'sentry/components/events/packageData';
import {EventUserFeedback} from 'sentry/components/events/userFeedback';
import {t} from 'sentry/locale';
import type {Entry, Event} from 'sentry/types/event';
import {EntryType} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {SharedViewOrganization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';

interface Props {
  event: Event | undefined;
  group: Group;
  organization: SharedViewOrganization;
  project: Project;
}

export function SharedEventContent({organization, project, event, group}: Props) {
  if (!event) {
    return (
      <Container padding="xl 3xl">
        <Heading as="h3">{t('Latest Event Not Available')}</Heading>
      </Container>
    );
  }

  const projectSlug = project.slug;

  return (
    <div>
      {event.userReport && (
        <ErrorBoundary mini>
          <EventDataSection title={t('User Feedback')} type="user-feedback">
            <EventUserFeedback
              report={event.userReport}
              orgSlug={organization.slug}
              issueId={group.id}
            />
          </EventDataSection>
        </ErrorBoundary>
      )}
      <ErrorBoundary mini>
        <EventEvidence event={event} project={project} />
      </ErrorBoundary>
      {Array.isArray(event.entries) &&
        event.entries.map((entry, entryIdx) => (
          <ErrorBoundary key={entryIdx} mini>
            <SharedEventEntry
              entry={entry}
              event={event}
              projectSlug={projectSlug}
              group={group}
            />
          </ErrorBoundary>
        ))}
      <ErrorBoundary mini>
        <EventPackageData event={event} />
      </ErrorBoundary>
    </div>
  );
}

function SharedEventEntry({
  entry,
  event,
  projectSlug,
  group,
}: {
  entry: Entry;
  event: Event;
  group: Group;
  projectSlug: string;
}) {
  const groupingCurrentLevel = group.metadata?.current_level;

  switch (entry.type) {
    case EntryType.EXCEPTION:
      return (
        <Exception
          event={event}
          group={group}
          data={entry.data}
          projectSlug={projectSlug}
          groupingCurrentLevel={groupingCurrentLevel}
        />
      );
    case EntryType.MESSAGE:
      return <Message event={event} data={entry.data} />;
    case EntryType.REQUEST:
      return <Request event={event} data={entry.data} />;
    case EntryType.STACKTRACE:
      return (
        <StackTrace
          event={event}
          data={entry.data}
          projectSlug={projectSlug}
          groupingCurrentLevel={groupingCurrentLevel}
        />
      );
    case EntryType.TEMPLATE:
      return <Template event={event} data={entry.data} />;
    case EntryType.CSP:
      return <Csp event={event} data={entry.data} />;
    case EntryType.EXPECTCT:
    case EntryType.EXPECTSTAPLE:
      return <Generic type={entry.type} data={entry.data} />;
    case EntryType.HPKP:
      return (
        <Generic type={entry.type} data={entry.data} meta={event._meta?.hpkp ?? {}} />
      );
    case EntryType.THREADS:
      return (
        <Threads
          event={event}
          group={group}
          data={entry.data}
          projectSlug={projectSlug}
          groupingCurrentLevel={groupingCurrentLevel}
        />
      );
    // DEBUGMETA and SPANS are intentionally omitted — not shown in shared views.
    // BREADCRUMBS are filtered out by SharedEventSerializer on the backend.
    default:
      return null;
  }
}
