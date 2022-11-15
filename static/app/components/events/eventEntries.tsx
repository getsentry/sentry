import {Fragment, useCallback, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import {Location} from 'history';
import uniq from 'lodash/uniq';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {Client} from 'sentry/api';
import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import ErrorBoundary from 'sentry/components/errorBoundary';
import EventContexts from 'sentry/components/events/contexts';
import EventContextSummary from 'sentry/components/events/contextSummary';
import EventDevice from 'sentry/components/events/device';
import EventErrors, {Error} from 'sentry/components/events/errors';
import EventAttachments from 'sentry/components/events/eventAttachments';
import EventCause from 'sentry/components/events/eventCause';
import EventDataSection from 'sentry/components/events/eventDataSection';
import EventExtraData from 'sentry/components/events/eventExtraData';
import {EventSdk} from 'sentry/components/events/eventSdk';
import {EventTags} from 'sentry/components/events/eventTags';
import EventGroupingInfo from 'sentry/components/events/groupingInfo';
import {EventPackageData} from 'sentry/components/events/packageData';
import RRWebIntegration from 'sentry/components/events/rrwebIntegration';
import EventSdkUpdates from 'sentry/components/events/sdkUpdates';
import {DataSection} from 'sentry/components/events/styles';
import EventUserFeedback from 'sentry/components/events/userFeedback';
import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {
  Entry,
  EntryType,
  Event,
  ExceptionValue,
  Group,
  IssueAttachment,
  IssueCategory,
  Organization,
  Project,
  SharedViewOrganization,
  Thread,
} from 'sentry/types';
import {DebugFile} from 'sentry/types/debugFiles';
import {Image} from 'sentry/types/debugImage';
import {isNotSharedOrganization} from 'sentry/types/utils';
import {defined, objectIsEmpty} from 'sentry/utils';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import withApi from 'sentry/utils/withApi';
import withOrganization from 'sentry/utils/withOrganization';
import {projectProcessingIssuesMessages} from 'sentry/views/settings/project/projectProcessingIssues';

import {CommitRow} from '../commitRow';

import findBestThread from './interfaces/threads/threadSelector/findBestThread';
import getThreadException from './interfaces/threads/threadSelector/getThreadException';
import EventEntry from './eventEntry';
import EventTagsAndScreenshot from './eventTagsAndScreenshot';

const MINIFIED_DATA_JAVA_EVENT_REGEX_MATCH =
  /^(([\w\$]\.[\w\$]{1,2})|([\w\$]{2}\.[\w\$]\.[\w\$]))(\.|$)/g;

function isDataMinified(str: string | null) {
  if (!str) {
    return false;
  }

  return !![...str.matchAll(MINIFIED_DATA_JAVA_EVENT_REGEX_MATCH)].length;
}

function hasThreadOrExceptionMinifiedFrameData(definedEvent: Event, bestThread?: Thread) {
  if (!bestThread) {
    const exceptionValues: Array<ExceptionValue> =
      definedEvent.entries?.find(e => e.type === EntryType.EXCEPTION)?.data?.values ?? [];

    return !!exceptionValues.find(exceptionValue =>
      exceptionValue.stacktrace?.frames?.find(frame => isDataMinified(frame.module))
    );
  }

  const threadExceptionValues = getThreadException(definedEvent, bestThread)?.values;

  return !!(threadExceptionValues
    ? threadExceptionValues.find(threadExceptionValue =>
        threadExceptionValue.stacktrace?.frames?.find(frame =>
          isDataMinified(frame.module)
        )
      )
    : bestThread?.stacktrace?.frames?.find(frame => isDataMinified(frame.module)));
}

type ProGuardErrors = Array<Error>;

type Props = Pick<React.ComponentProps<typeof EventEntry>, 'route' | 'router'> & {
  api: Client;
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
  api,
  event,
  group,
  className,
  router,
  route,
  isShare = false,
  showTagSummary = true,
}: Props) => {
  const [isLoading, setIsLoading] = useState(true);
  const [proGuardErrors, setProGuardErrors] = useState<ProGuardErrors>([]);
  const [attachments, setAttachments] = useState<IssueAttachment[]>([]);

  const orgSlug = organization.slug;
  const projectSlug = project.slug;
  const orgFeatures = organization?.features ?? [];

  const hasEventAttachmentsFeature = orgFeatures.includes('event-attachments');
  const hasReplay = Boolean(event?.tags?.find(({key}) => key === 'replayId')?.value);

  const recordIssueError = useCallback(() => {
    if (!event || !event.errors || !(event.errors.length > 0)) {
      return;
    }

    const errors = event.errors;
    const errorTypes = errors.map(errorEntries => errorEntries.type);
    const errorMessages = errors.map(errorEntries => errorEntries.message);

    const platform = project.platform;

    // uniquify the array types
    trackAdvancedAnalyticsEvent('issue_error_banner.viewed', {
      organization: organization as Organization,
      group: event?.groupID,
      error_type: uniq(errorTypes),
      error_message: uniq(errorMessages),
      ...(platform && {platform}),
    });
  }, [event, organization, project.platform]);

  const fetchProguardMappingFiles = useCallback(
    async (query: string): Promise<Array<DebugFile>> => {
      try {
        const proguardMappingFiles = await api.requestPromise(
          `/projects/${orgSlug}/${projectSlug}/files/dsyms/`,
          {
            method: 'GET',
            query: {
              query,
              file_formats: 'proguard',
            },
          }
        );
        return proguardMappingFiles;
      } catch (error) {
        Sentry.captureException(error);
        // do nothing, the UI will not display extra error details
        return [];
      }
    },
    [api, orgSlug, projectSlug]
  );

  const checkProGuardError = useCallback(async () => {
    if (!event || event.platform !== 'java') {
      setIsLoading(false);
      return;
    }

    const hasEventErrorsProGuardMissingMapping = event.errors?.find(
      error => error.type === 'proguard_missing_mapping'
    );

    if (hasEventErrorsProGuardMissingMapping) {
      setIsLoading(false);
      return;
    }

    const newProGuardErrors: ProGuardErrors = [];

    const debugImages = event.entries?.find(e => e.type === EntryType.DEBUGMETA)?.data
      .images as undefined | Array<Image>;

    // When debugImages contains a 'proguard' entry, it must always be only one entry
    const proGuardImage = debugImages?.find(
      debugImage => debugImage?.type === 'proguard'
    );

    const proGuardImageUuid = proGuardImage?.uuid;

    // If an entry is of type 'proguard' and has 'uuid',
    // it means that the Sentry Gradle plugin has been executed,
    // otherwise the proguard id wouldn't be in the event.
    // But maybe it failed to upload the mappings file
    if (defined(proGuardImageUuid)) {
      if (isShare) {
        setIsLoading(false);
        return;
      }

      const proguardMappingFiles = await fetchProguardMappingFiles(proGuardImageUuid);

      if (!proguardMappingFiles.length) {
        newProGuardErrors.push({
          type: 'proguard_missing_mapping',
          message: projectProcessingIssuesMessages.proguard_missing_mapping,
          data: {mapping_uuid: proGuardImageUuid},
        });
      }

      setProGuardErrors(newProGuardErrors);
      setIsLoading(false);
      return;
    }

    if (proGuardImage) {
      Sentry.withScope(function (s) {
        s.setLevel('warning');
        if (event.sdk) {
          s.setTag('offending.event.sdk.name', event.sdk.name);
          s.setTag('offending.event.sdk.version', event.sdk.version);
        }
        Sentry.captureMessage('Event contains proguard image but not uuid');
      });
    }

    const threads: Array<Thread> =
      event.entries?.find(e => e.type === EntryType.THREADS)?.data?.values ?? [];

    const bestThread = findBestThread(threads);
    const hasThreadOrExceptionMinifiedData = hasThreadOrExceptionMinifiedFrameData(
      event,
      bestThread
    );

    if (hasThreadOrExceptionMinifiedData) {
      newProGuardErrors.push({
        type: 'proguard_potentially_misconfigured_plugin',
        message: tct(
          'Some frames appear to be minified. Did you configure the [plugin]?',
          {
            plugin: (
              <ExternalLink href="https://docs.sentry.io/platforms/android/proguard/#gradle">
                Sentry Gradle Plugin
              </ExternalLink>
            ),
          }
        ),
      });
    }

    setProGuardErrors(newProGuardErrors);
    setIsLoading(false);
  }, [event, fetchProguardMappingFiles, isShare]);

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
    checkProGuardError();
  }, [checkProGuardError]);

  useEffect(() => {
    recordIssueError();
  }, [recordIssueError]);

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

  const hasMobileScreenshotsFeature = orgFeatures.includes('mobile-screenshots');
  const hasContext = !objectIsEmpty(event.user ?? {}) || !objectIsEmpty(event.contexts);
  const hasErrors = !objectIsEmpty(event.errors) || !!proGuardErrors.length;

  return (
    <div className={className} data-test-id={`event-entries-loading-${isLoading}`}>
      {hasErrors && !isLoading && (
        <EventErrors
          event={event}
          orgSlug={orgSlug}
          projectSlug={projectSlug}
          proGuardErrors={proGuardErrors}
        />
      )}
      {!isShare && isNotSharedOrganization(organization) && (
        <EventCause
          project={project}
          eventId={event.id}
          group={group}
          commitRow={CommitRow}
        />
      )}
      {event.userReport && group && (
        <StyledEventUserFeedback
          report={event.userReport}
          orgId={orgSlug}
          issueId={group.id}
          includeBorder={!hasErrors}
        />
      )}
      {showTagSummary &&
        (hasMobileScreenshotsFeature ? (
          <EventTagsAndScreenshot
            event={event}
            organization={organization as Organization}
            projectId={projectSlug}
            location={location}
            isShare={isShare}
            hasContext={hasContext}
            attachments={attachments}
            onDeleteScreenshot={handleDeleteAttachment}
          />
        ) : (
          (!!(event.tags ?? []).length || hasContext) && (
            <StyledEventDataSection
              title={<GuideAnchor target="tags">{t('Tags')}</GuideAnchor>}
              type="tags"
            >
              {hasContext && <EventContextSummary event={event} />}
              <EventTags
                event={event}
                organization={organization as Organization}
                projectId={projectSlug}
                location={location}
              />
            </StyledEventDataSection>
          )
        ))}
      <Entries
        definedEvent={event}
        projectSlug={projectSlug}
        group={group}
        organization={organization}
        route={route}
        router={router}
        isShare={isShare}
      />
      {hasContext && <EventContexts group={group} event={event} />}
      {event && !objectIsEmpty(event.context) && <EventExtraData event={event} />}
      {event && !objectIsEmpty(event.packages) && <EventPackageData event={event} />}
      {event && !objectIsEmpty(event.device) && <EventDevice event={event} />}
      {!isShare && hasEventAttachmentsFeature && (
        <EventAttachments
          event={event}
          orgId={orgSlug}
          projectId={projectSlug}
          location={location}
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
          projectId={projectSlug}
          event={event}
          showGroupingConfig={
            orgFeatures.includes('set-grouping-config') && 'groupingConfig' in event
          }
        />
      )}
      {!isShare && !hasReplay && hasEventAttachmentsFeature && (
        <RRWebIntegration
          event={event}
          orgId={orgSlug}
          projectId={projectSlug}
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
  route,
  router,
}: {
  definedEvent: Event;
  projectSlug: string;
  isShare?: boolean;
} & Pick<Props, 'group' | 'organization' | 'route' | 'router'>) {
  if (!Array.isArray(definedEvent.entries)) {
    return null;
  }

  if (
    group?.issueCategory === IssueCategory.PERFORMANCE &&
    organization.features?.includes('performance-issues')
  ) {
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
            route={route}
            router={router}
            isShare={isShare}
          />
        </ErrorBoundary>
      ))}
    </Fragment>
  );
}

const StyledEventDataSection = styled(EventDataSection)`
  /* Hiding the top border because of the event section appears at this breakpoint */
  @media (max-width: 767px) {
    &:first-of-type {
      border-top: none;
    }
  }
`;

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

type StyledEventUserFeedbackProps = {
  includeBorder: boolean;
};

const StyledEventUserFeedback = styled(EventUserFeedback)<StyledEventUserFeedbackProps>`
  border-radius: 0;
  box-shadow: none;
  padding: ${space(3)} ${space(4)} 0 40px;
  border: 0;
  ${p => (p.includeBorder ? `border-top: 1px solid ${p.theme.innerBorder};` : '')}
  margin: 0;
`;

const StyledReplayEventDataSection = styled(EventDataSection)`
  overflow: hidden;
  margin-bottom: ${space(3)};
`;

// TODO(ts): any required due to our use of SharedViewOrganization
export default withOrganization<any>(withApi(EventEntries));
export {BorderlessEventEntries};
