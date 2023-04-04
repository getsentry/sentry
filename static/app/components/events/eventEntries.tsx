import {Fragment} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import {CommitRow} from 'sentry/components/commitRow';
import {EventEvidence} from 'sentry/components/events/eventEvidence';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {
  Entry,
  Event,
  Group,
  Organization,
  Project,
  SharedViewOrganization,
} from 'sentry/types';
import {isNotSharedOrganization} from 'sentry/types/utils';
import {objectIsEmpty} from 'sentry/utils';

import {EventContexts} from './contexts';
import {EventDevice} from './device';
import {EventAttachments} from './eventAttachments';
import {EventCause} from './eventCause';
import {EventDataSection} from './eventDataSection';
import {EventEntry} from './eventEntry';
import {EventErrors} from './eventErrors';
import {EventExtraData} from './eventExtraData';
import {EventSdk} from './eventSdk';
import {EventTagsAndScreenshot} from './eventTagsAndScreenshot';
import {EventViewHierarchy} from './eventViewHierarchy';
import {EventGroupingInfo} from './groupingInfo';
import {EventPackageData} from './packageData';
import {EventRRWebIntegration} from './rrwebIntegration';
import {EventSdkUpdates} from './sdkUpdates';
import {DataSection} from './styles';
import {EventUserFeedback} from './userFeedback';

type Props = {
  location: Location;
  /**
   * The organization can be the shared view on a public issue view.
   */
  organization: Organization | SharedViewOrganization;
  project: Project;
  className?: string;
  event?: Event;
  group?: Group;
  isShare?: boolean;
  showTagSummary?: boolean;
};

function EventEntries({
  organization,
  project,
  location,
  event,
  group,
  className,
  isShare = false,
  showTagSummary = true,
}: Props) {
  const orgSlug = organization.slug;
  const projectSlug = project.slug;
  const orgFeatures = organization?.features ?? [];

  if (!event) {
    return (
      <LatestEventNotAvailable>
        <h3>{t('Latest Event Not Available')}</h3>
      </LatestEventNotAvailable>
    );
  }

  const hasContext = !objectIsEmpty(event.user ?? {}) || !objectIsEmpty(event.contexts);

  return (
    <div className={className}>
      <EventErrors event={event} project={project} isShare={isShare} />
      {!isShare && isNotSharedOrganization(organization) && (
        <EventCause
          project={project}
          eventId={event.id}
          group={group}
          commitRow={CommitRow}
        />
      )}
      {event.userReport && group && (
        <EventDataSection title="User Feedback" type="user-feedback">
          <EventUserFeedback
            report={event.userReport}
            orgId={orgSlug}
            issueId={group.id}
          />
        </EventDataSection>
      )}
      {showTagSummary && (
        <EventTagsAndScreenshot
          event={event}
          organization={organization as Organization}
          projectSlug={projectSlug}
          location={location}
          isShare={isShare}
        />
      )}
      <EventEvidence event={event} projectSlug={project.slug} />
      <Entries
        definedEvent={event}
        projectSlug={projectSlug}
        group={group}
        organization={organization}
        isShare={isShare}
      />
      {hasContext && <EventContexts group={group} event={event} />}
      <EventExtraData event={event} />
      <EventPackageData event={event} />
      <EventDevice event={event} />
      {!isShare && <EventViewHierarchy event={event} project={project} />}
      {!isShare && <EventAttachments event={event} projectSlug={projectSlug} />}
      <EventSdk sdk={event.sdk} meta={event._meta?.sdk} />
      {!isShare && <EventSdkUpdates event={event} />}
      {!isShare && event.groupID && (
        <EventGroupingInfo
          projectSlug={projectSlug}
          event={event}
          showGroupingConfig={
            orgFeatures.includes('set-grouping-config') && 'groupingConfig' in event
          }
        />
      )}
      {!isShare && (
        <EventRRWebIntegration event={event} orgId={orgSlug} projectSlug={projectSlug} />
      )}
    </div>
  );
}

function Entries({
  definedEvent,
  projectSlug,
  isShare,
  group,
  organization,
}: {
  definedEvent: Event;
  projectSlug: string;
  isShare?: boolean;
} & Pick<Props, 'group' | 'organization'>) {
  if (!Array.isArray(definedEvent.entries)) {
    return null;
  }

  return (
    <Fragment>
      {(definedEvent.entries as Array<Entry>).map((entry, entryIdx) => (
        <EventEntry
          key={entryIdx}
          projectSlug={projectSlug}
          group={group}
          organization={organization}
          event={definedEvent}
          entry={entry}
          isShare={isShare}
        />
      ))}
    </Fragment>
  );
}

const LatestEventNotAvailable = styled('div')`
  padding: ${space(2)} ${space(4)};
`;

const BorderlessEventEntries = styled(EventEntries)`
  & ${DataSection} {
    margin-left: 0 !important;
    margin-right: 0 !important;
    padding: ${space(3)} 0 0 0;
  }
  & ${DataSection}:first-child {
    padding-top: 0;
    border-top: 0;
  }
`;

export {EventEntries, BorderlessEventEntries};
