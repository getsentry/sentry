import {Fragment} from 'react';
import styled from '@emotion/styled';

import {CommitRow} from 'sentry/components/commitRow';
import {AiSuggestedSolution} from 'sentry/components/events/aiSuggestedSolution';
import {EventContexts} from 'sentry/components/events/contexts';
import {EventDevice} from 'sentry/components/events/device';
import {EventAttachments} from 'sentry/components/events/eventAttachments';
import {EventCause} from 'sentry/components/events/eventCause';
import {EventDataSection} from 'sentry/components/events/eventDataSection';
import {EventEntry} from 'sentry/components/events/eventEntry';
import {EventErrors} from 'sentry/components/events/eventErrors';
import {EventEvidence} from 'sentry/components/events/eventEvidence';
import {EventExtraData} from 'sentry/components/events/eventExtraData';
import {EventSdk} from 'sentry/components/events/eventSdk';
import {EventTagsAndScreenshot} from 'sentry/components/events/eventTagsAndScreenshot';
import {EventViewHierarchy} from 'sentry/components/events/eventViewHierarchy';
import {EventGroupingInfo} from 'sentry/components/events/groupingInfo';
import {AnrRootCause} from 'sentry/components/events/interfaces/performance/anrRootCause';
import {Resources} from 'sentry/components/events/interfaces/performance/resources';
import {SpanEvidenceSection} from 'sentry/components/events/interfaces/performance/spanEvidence';
import {EventPackageData} from 'sentry/components/events/packageData';
import {EventRRWebIntegration} from 'sentry/components/events/rrwebIntegration';
import {EventUserFeedback} from 'sentry/components/events/userFeedback';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Event, Group, IssueCategory, Project} from 'sentry/types';
import {EntryType, EventTransaction} from 'sentry/types/event';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

type GroupEventDetailsContentProps = {
  group: Group;
  project: Project;
  event?: Event;
};

type GroupEventEntryProps = {
  entryType: EntryType;
  event: Event;
  group: Group;
  project: Project;
};

function GroupEventEntry({event, entryType, group, project}: GroupEventEntryProps) {
  const organization = useOrganization();
  const matchingEntry = event.entries.find(entry => entry.type === entryType);

  if (!matchingEntry) {
    return null;
  }

  return (
    <EventEntry
      projectSlug={project.slug}
      group={group}
      entry={matchingEntry}
      {...{organization, event}}
    />
  );
}

function GroupEventDetailsContent({
  group,
  event,
  project,
}: GroupEventDetailsContentProps) {
  const organization = useOrganization();
  const location = useLocation();
  const hasReplay = Boolean(event?.tags?.find(({key}) => key === 'replayId')?.value);
  const isANR = event?.tags?.find(({key}) => key === 'mechanism')?.value === 'ANR';
  const hasAnrImprovementsFeature = organization.features.includes('anr-improvements');

  if (!event) {
    return (
      <NotFoundMessage>
        <h3>{t('Latest event not available')}</h3>
      </NotFoundMessage>
    );
  }

  const eventEntryProps = {group, event, project};

  return (
    <Fragment>
      <EventErrors event={event} project={project} isShare={false} />
      <EventCause
        project={project}
        eventId={event.id}
        group={group}
        commitRow={CommitRow}
      />
      {event.userReport && (
        <EventDataSection title="User Feedback" type="user-feedback">
          <EventUserFeedback
            report={event.userReport}
            orgId={organization.slug}
            issueId={group.id}
          />
        </EventDataSection>
      )}
      <EventTagsAndScreenshot
        event={event}
        organization={organization}
        projectSlug={project.slug}
        location={location}
      />
      <EventEvidence event={event} group={group} projectSlug={project.slug} />
      <GroupEventEntry entryType={EntryType.MESSAGE} {...eventEntryProps} />
      <GroupEventEntry entryType={EntryType.EXCEPTION} {...eventEntryProps} />
      <GroupEventEntry entryType={EntryType.STACKTRACE} {...eventEntryProps} />
      <GroupEventEntry entryType={EntryType.THREADS} {...eventEntryProps} />
      {hasAnrImprovementsFeature && isANR && (
        <AnrRootCause event={event} organization={organization} />
      )}
      {group.issueCategory === IssueCategory.PERFORMANCE && (
        <SpanEvidenceSection
          event={event as EventTransaction}
          organization={organization}
          projectSlug={project.slug}
        />
      )}
      <GroupEventEntry entryType={EntryType.HPKP} {...eventEntryProps} />
      <GroupEventEntry entryType={EntryType.CSP} {...eventEntryProps} />
      <GroupEventEntry entryType={EntryType.EXPECTCT} {...eventEntryProps} />
      <GroupEventEntry entryType={EntryType.EXPECTSTAPLE} {...eventEntryProps} />
      <GroupEventEntry entryType={EntryType.TEMPLATE} {...eventEntryProps} />
      <GroupEventEntry entryType={EntryType.BREADCRUMBS} {...eventEntryProps} />
      <Resources {...{event, group}} />
      <GroupEventEntry entryType={EntryType.REQUEST} {...eventEntryProps} />
      <GroupEventEntry entryType={EntryType.DEBUGMETA} {...eventEntryProps} />
      <AiSuggestedSolution event={event} projectSlug={project.slug} />
      <EventContexts group={group} event={event} />
      <EventExtraData event={event} />
      <EventPackageData event={event} />
      <EventDevice event={event} />
      <EventViewHierarchy event={event} project={project} />
      <EventAttachments event={event} projectSlug={project.slug} />
      <EventSdk sdk={event.sdk} meta={event._meta?.sdk} />
      {event.groupID && (
        <EventGroupingInfo
          projectSlug={project.slug}
          event={event}
          showGroupingConfig={
            organization.features.includes('set-grouping-config') &&
            'groupingConfig' in event
          }
        />
      )}

      {!hasReplay && (
        <EventRRWebIntegration
          event={event}
          orgId={organization.slug}
          projectSlug={project.slug}
        />
      )}
    </Fragment>
  );
}

const NotFoundMessage = styled('div')`
  padding: ${space(2)} ${space(4)};
`;

export default GroupEventDetailsContent;
