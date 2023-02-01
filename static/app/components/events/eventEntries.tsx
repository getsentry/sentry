import {Fragment, useCallback, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import {Location} from 'history';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {CommitRow} from 'sentry/components/commitRow';
import ErrorBoundary from 'sentry/components/errorBoundary';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {
  Entry,
  EntryType,
  Event,
  Group,
  IssueAttachment,
  IssueCategory,
  Organization,
  Project,
  SharedViewOrganization,
} from 'sentry/types';
import {isNotSharedOrganization} from 'sentry/types/utils';
import {objectIsEmpty} from 'sentry/utils';
import useApi from 'sentry/utils/useApi';

import {EventContexts} from './contexts';
import {EventDevice} from './device';
import {EventAttachments} from './eventAttachments';
import {EventCause} from './eventCause';
import {EventDataSection} from './eventDataSection';
import {EventEntry} from './eventEntry';
import {EventErrors} from './eventErrors';
import {EventEvidence} from './eventEvidence';
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

const EventEntries = ({
  organization,
  project,
  location,
  event,
  group,
  className,
  isShare = false,
  showTagSummary = true,
}: Props) => {
  const api = useApi();

  const [attachments, setAttachments] = useState<IssueAttachment[]>([]);

  const orgSlug = organization.slug;
  const projectSlug = project.slug;
  const orgFeatures = organization?.features ?? [];

  const hasEventAttachmentsFeature = orgFeatures.includes('event-attachments');
  const hasReplay = Boolean(event?.tags?.find(({key}) => key === 'replayId')?.value);

  const fetchAttachments = useCallback(async () => {
    if (!event || isShare || !hasEventAttachmentsFeature) {
      return;
    }

    try {
      const response = await api.requestPromise(
        `/projects/${orgSlug}/${projectSlug}/events/${event.id}/attachments/`
      );
      setAttachments(response);
    } catch (error) {
      Sentry.captureException(error);
      addErrorMessage('An error occurred while fetching attachments');
    }
  }, [api, event, hasEventAttachmentsFeature, isShare, orgSlug, projectSlug]);

  const handleDeleteAttachment = useCallback(
    async (attachmentId: IssueAttachment['id']) => {
      if (!event) {
        return;
      }

      try {
        await api.requestPromise(
          `/projects/${orgSlug}/${projectSlug}/events/${event.id}/attachments/${attachmentId}/`,
          {
            method: 'DELETE',
          }
        );

        setAttachments(attachments.filter(attachment => attachment.id !== attachmentId));
      } catch (error) {
        Sentry.captureException(error);
        addErrorMessage('An error occurred while deleting the attachment');
      }
    },
    [api, attachments, event, orgSlug, projectSlug]
  );

  useEffect(() => {
    fetchAttachments();
  }, [fetchAttachments]);

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
          hasContext={hasContext}
          attachments={attachments}
          onDeleteScreenshot={handleDeleteAttachment}
        />
      )}
      <EventEvidence event={event} group={group} />
      <Entries
        definedEvent={event}
        projectSlug={projectSlug}
        group={group}
        organization={organization}
        isShare={isShare}
      />
      {hasContext && <EventContexts group={group} event={event} />}
      {event && !objectIsEmpty(event.context) && <EventExtraData event={event} />}
      {event && !objectIsEmpty(event.packages) && <EventPackageData event={event} />}
      {event && !objectIsEmpty(event.device) && <EventDevice event={event} />}
      {!isShare &&
        organization.features?.includes('mobile-view-hierarchies') &&
        hasEventAttachmentsFeature &&
        !!attachments.filter(attachment => attachment.type === 'event.view_hierarchy')
          .length && (
          <EventViewHierarchy
            project={project}
            viewHierarchies={attachments.filter(
              attachment => attachment.type === 'event.view_hierarchy'
            )}
          />
        )}
      {!isShare && hasEventAttachmentsFeature && (
        <EventAttachments
          event={event}
          projectSlug={projectSlug}
          attachments={attachments}
          onDeleteAttachment={handleDeleteAttachment}
        />
      )}
      {event.sdk && !objectIsEmpty(event.sdk) && (
        <EventSdk sdk={event.sdk} meta={event._meta?.sdk} />
      )}
      {!isShare && event?.sdkUpdates && event.sdkUpdates.length > 0 && (
        <EventSdkUpdates event={{sdkUpdates: event.sdkUpdates, ...event}} />
      )}
      {!isShare && event.groupID && (
        <EventGroupingInfo
          projectSlug={projectSlug}
          event={event}
          showGroupingConfig={
            orgFeatures.includes('set-grouping-config') && 'groupingConfig' in event
          }
        />
      )}
      {!isShare && !hasReplay && hasEventAttachmentsFeature && (
        <EventRRWebIntegration
          event={event}
          orgId={orgSlug}
          projectSlug={projectSlug}
          renderer={children => (
            <StyledReplayEventDataSection type="context-replay" title={t('Replay')}>
              {children}
            </StyledReplayEventDataSection>
          )}
        />
      )}
    </div>
  );
};

function injectResourcesEntry(definedEvent: Event) {
  const entries = definedEvent.entries;
  let adjustedEntries: Entry[] = [];

  // This check is to ensure we are not injecting multiple Resources entries
  const resourcesIndex = entries.findIndex(entry => entry.type === EntryType.RESOURCES);
  if (resourcesIndex === -1) {
    const spansIndex = entries.findIndex(entry => entry.type === EntryType.SPANS);
    const breadcrumbsIndex = entries.findIndex(
      entry => entry.type === EntryType.BREADCRUMBS
    );

    // We want the Resources section to appear after Breadcrumbs.
    // If Breadcrumbs are included on this event, we will inject this entry right after it.
    // Otherwise, we inject it after the Spans entry.
    const resourcesEntry: Entry = {type: EntryType.RESOURCES, data: null};
    if (breadcrumbsIndex > -1) {
      adjustedEntries = [
        ...entries.slice(0, breadcrumbsIndex + 1),
        resourcesEntry,
        ...entries.slice(breadcrumbsIndex + 1, entries.length),
      ];
    } else if (spansIndex > -1) {
      adjustedEntries = [
        ...entries.slice(0, spansIndex + 1),
        resourcesEntry,
        ...entries.slice(spansIndex + 1, entries.length),
      ];
    }
  }

  if (adjustedEntries.length > 0) {
    definedEvent.entries = adjustedEntries;
  }
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

  if (group?.issueCategory === IssueCategory.PERFORMANCE) {
    injectResourcesEntry(definedEvent);
  }

  return (
    <Fragment>
      {(definedEvent.entries as Array<Entry>).map((entry, entryIdx) => (
        <ErrorBoundary
          key={`entry-${entryIdx}`}
          customComponent={
            <EventDataSection type={entry.type} title={entry.type}>
              <p>{t('There was an error rendering this data.')}</p>
            </EventDataSection>
          }
        >
          <EventEntry
            projectSlug={projectSlug}
            group={group}
            organization={organization}
            event={definedEvent}
            entry={entry}
            isShare={isShare}
          />
        </ErrorBoundary>
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

const StyledReplayEventDataSection = styled(EventDataSection)`
  overflow: hidden;
  margin-bottom: ${space(3)};
`;

export {EventEntries, BorderlessEventEntries};
