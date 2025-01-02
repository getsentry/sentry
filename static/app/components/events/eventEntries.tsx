import {Fragment} from 'react';
import styled from '@emotion/styled';

import {CommitRow} from 'sentry/components/commitRow';
import {EventEvidence} from 'sentry/components/events/eventEvidence';
import EventHydrationDiff from 'sentry/components/events/eventHydrationDiff';
import EventReplay from 'sentry/components/events/eventReplay';
import {EventGroupingInfoSection} from 'sentry/components/events/groupingInfo/groupingInfoSection';
import {ActionableItems} from 'sentry/components/events/interfaces/crashContent/exception/actionableItems';
import {actionableItemsEnabled} from 'sentry/components/events/interfaces/crashContent/exception/useActionableItems';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Entry, Event} from 'sentry/types/event';
import {EntryType} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Organization, SharedViewOrganization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {isNotSharedOrganization} from 'sentry/types/utils';
import {isEmptyObject} from 'sentry/utils/object/isEmptyObject';

import {EventContexts} from './contexts';
import {EventDevice} from './device';
import {EventAttachments} from './eventAttachments';
import {EventDataSection} from './eventDataSection';
import {EventEntry} from './eventEntry';
import {EventExtraData} from './eventExtraData';
import {EventSdk} from './eventSdk';
import {EventTagsAndScreenshot} from './eventTagsAndScreenshot';
import {EventViewHierarchy} from './eventViewHierarchy';
import {EventPackageData} from './packageData';
import {EventRRWebIntegration} from './rrwebIntegration';
import {DataSection} from './styles';
import {SuspectCommits} from './suspectCommits';
import {EventUserFeedback} from './userFeedback';

type Props = {
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

  const hasContext = !isEmptyObject(event.user ?? {}) || !isEmptyObject(event.contexts);
  const hasActionableItems = actionableItemsEnabled({
    eventId: event.id,
    organization,
    projectSlug,
  });

  return (
    <div className={className}>
      {hasActionableItems && (
        <ActionableItems event={event} project={project} isShare={isShare} />
      )}
      {!isShare && isNotSharedOrganization(organization) && (
        <SuspectCommits
          projectSlug={project.slug}
          eventId={event.id}
          group={group}
          commitRow={CommitRow}
        />
      )}
      {event.userReport && group && (
        <EventDataSection title="User Feedback" type="user-feedback">
          <EventUserFeedback
            report={event.userReport}
            orgSlug={orgSlug}
            issueId={group.id}
          />
        </EventDataSection>
      )}
      {showTagSummary && (
        <EventTagsAndScreenshot
          event={event}
          projectSlug={projectSlug}
          isShare={isShare}
        />
      )}
      <EventEvidence event={event} project={project} />
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
      {!isShare && <EventAttachments event={event} project={project} group={group} />}
      <EventSdk sdk={event.sdk} meta={event._meta?.sdk} />
      {!isShare && event.groupID && (
        <EventGroupingInfoSection
          projectSlug={projectSlug}
          event={event}
          showGroupingConfig={
            orgFeatures.includes('set-grouping-config') && 'groupingConfig' in event
          }
          group={group}
        />
      )}
      {!isShare && (
        <EventRRWebIntegration event={event} orgId={orgSlug} projectSlug={projectSlug} />
      )}
    </div>
  );
}

// The ordering for event entries is owned by the interface serializers on the backend.
// Because replays are not an interface, we need to manually insert the replay section
// into the array of entries. The long-term solution here is to move the ordering
// logic to this component, similar to how GroupEventDetailsContent works.
export function partitionEntriesForReplay(entries: Entry[]) {
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

export function Entries({
  definedEvent,
  projectSlug,
  isShare,
  group,
  organization,
  hideBeforeReplayEntries = false,
  hideBreadCrumbs = false,
}: {
  definedEvent: Event;
  projectSlug: string;
  hideBeforeReplayEntries?: boolean;
  hideBreadCrumbs?: boolean;
  isShare?: boolean;
} & Pick<Props, 'group' | 'organization'>) {
  if (!Array.isArray(definedEvent.entries)) {
    return null;
  }

  const [beforeReplayEntries, afterReplayEntries] = partitionEntriesForReplay(
    definedEvent.entries
  );

  const eventEntryProps = {
    projectSlug,
    group,
    organization,
    event: definedEvent,
    isShare,
  };

  return (
    <Fragment>
      {!hideBeforeReplayEntries &&
        beforeReplayEntries!.map((entry, entryIdx) => (
          <EventEntry key={entryIdx} entry={entry} {...eventEntryProps} />
        ))}
      {!isShare && <EventHydrationDiff {...eventEntryProps} />}
      {!isShare && <EventReplay {...eventEntryProps} />}
      {afterReplayEntries!.map((entry, entryIdx) => {
        if (hideBreadCrumbs && entry.type === EntryType.BREADCRUMBS) {
          return null;
        }

        return <EventEntry key={entryIdx} entry={entry} {...eventEntryProps} />;
      })}
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
