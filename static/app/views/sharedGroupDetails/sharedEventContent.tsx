import styled from '@emotion/styled';

import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {EventDataSection} from 'sentry/components/events/eventDataSection';
import {EventEntry} from 'sentry/components/events/eventEntry';
import {EventEvidence} from 'sentry/components/events/eventEvidence';
import {EventPackageData} from 'sentry/components/events/packageData';
import {EventUserFeedback} from 'sentry/components/events/userFeedback';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {SharedViewOrganization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';

interface Props {
  organization: SharedViewOrganization;
  project: Project;
  event?: Event;
  group?: Group;
}

export function SharedEventContent({organization, project, event, group}: Props) {
  if (!event) {
    return (
      <LatestEventNotAvailable>
        <h3>{t('Latest Event Not Available')}</h3>
      </LatestEventNotAvailable>
    );
  }

  const projectSlug = project.slug;

  return (
    <div>
      {event.userReport && group && (
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
          <EventEntry
            key={entryIdx}
            entry={entry}
            projectSlug={projectSlug}
            group={group}
            organization={organization}
            event={event}
            isShare
          />
        ))}
      <ErrorBoundary mini>
        <EventPackageData event={event} />
      </ErrorBoundary>
    </div>
  );
}

const LatestEventNotAvailable = styled('div')`
  padding: ${p => p.theme.space.xl} ${p => p.theme.space['3xl']};
`;
