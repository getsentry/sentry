import {Fragment} from 'react';
import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import {CommitRow} from 'sentry/components/commitRow';
import ErrorBoundary from 'sentry/components/errorBoundary';
import {EventContexts} from 'sentry/components/events/contexts';
import {EventDevice} from 'sentry/components/events/device';
import {EventAttachments} from 'sentry/components/events/eventAttachments';
import {EventDataSection} from 'sentry/components/events/eventDataSection';
import {EventEntry} from 'sentry/components/events/eventEntry';
import {EventEvidence} from 'sentry/components/events/eventEvidence';
import {EventExtraData} from 'sentry/components/events/eventExtraData';
import EventReplay from 'sentry/components/events/eventReplay';
import {EventSdk} from 'sentry/components/events/eventSdk';
import AggregateSpanDiff from 'sentry/components/events/eventStatisticalDetector/aggregateSpanDiff';
import EventBreakpointChart from 'sentry/components/events/eventStatisticalDetector/breakpointChart';
import {EventAffectedTransactions} from 'sentry/components/events/eventStatisticalDetector/eventAffectedTransactions';
import EventComparison from 'sentry/components/events/eventStatisticalDetector/eventComparison';
import {EventDifferentialFlamegraph} from 'sentry/components/events/eventStatisticalDetector/eventDifferentialFlamegraph';
import {EventFunctionComparisonList} from 'sentry/components/events/eventStatisticalDetector/eventFunctionComparisonList';
import {EventRegressionSummary} from 'sentry/components/events/eventStatisticalDetector/eventRegressionSummary';
import {EventFunctionBreakpointChart} from 'sentry/components/events/eventStatisticalDetector/functionBreakpointChart';
import {TransactionsDeltaProvider} from 'sentry/components/events/eventStatisticalDetector/transactionsDeltaProvider';
import {EventTagsAndScreenshot} from 'sentry/components/events/eventTagsAndScreenshot';
import {EventViewHierarchy} from 'sentry/components/events/eventViewHierarchy';
import {EventGroupingInfo} from 'sentry/components/events/groupingInfo';
import {ActionableItems} from 'sentry/components/events/interfaces/crashContent/exception/actionableItems';
import {actionableItemsEnabled} from 'sentry/components/events/interfaces/crashContent/exception/useActionableItems';
import {CronTimelineSection} from 'sentry/components/events/interfaces/crons/cronTimelineSection';
import {AnrRootCause} from 'sentry/components/events/interfaces/performance/anrRootCause';
import {SpanEvidenceSection} from 'sentry/components/events/interfaces/performance/spanEvidence';
import {EventPackageData} from 'sentry/components/events/packageData';
import {EventRRWebIntegration} from 'sentry/components/events/rrwebIntegration';
import {DataSection} from 'sentry/components/events/styles';
import {SuspectCommits} from 'sentry/components/events/suspectCommits';
import {EventUserFeedback} from 'sentry/components/events/userFeedback';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Event, Group, IssueCategory, IssueType, Project} from 'sentry/types';
import {EntryType, EventTransaction} from 'sentry/types/event';
import {shouldShowCustomErrorResourceConfig} from 'sentry/utils/issueTypeConfig';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {ResourcesAndMaybeSolutions} from 'sentry/views/issueDetails/resourcesAndMaybeSolutions';

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

function DefaultGroupEventDetailsContent({
  group,
  event,
  project,
}: Required<GroupEventDetailsContentProps>) {
  const organization = useOrganization();
  const location = useLocation();
  const projectSlug = project.slug;
  const hasReplay = Boolean(event.tags?.find(({key}) => key === 'replayId')?.value);
  const mechanism = event.tags?.find(({key}) => key === 'mechanism')?.value;
  const isANR = mechanism === 'ANR' || mechanism === 'AppExitInfo';
  const hasAnrImprovementsFeature = organization.features.includes('anr-improvements');
  const showMaybeSolutionsHigher = shouldShowCustomErrorResourceConfig(group, project);

  const eventEntryProps = {group, event, project};

  const hasActionableItems = actionableItemsEnabled({
    eventId: event.id,
    organization,
    projectSlug,
  });

  return (
    <Fragment>
      {hasActionableItems && (
        <ActionableItems event={event} project={project} isShare={false} />
      )}
      <SuspectCommits
        project={project}
        eventId={event.id}
        group={group}
        commitRow={CommitRow}
      />
      {event.userReport && (
        <EventDataSection title="User Feedback" type="user-feedback">
          <EventUserFeedback
            report={event.userReport}
            orgSlug={organization.slug}
            issueId={group.id}
          />
        </EventDataSection>
      )}
      {group.issueCategory === IssueCategory.CRON && (
        <CronTimelineSection event={event} organization={organization} />
      )}
      <EventTagsAndScreenshot
        event={event}
        organization={organization}
        projectSlug={project.slug}
        location={location}
      />
      {showMaybeSolutionsHigher && (
        <ResourcesAndMaybeSolutions event={event} project={project} group={group} />
      )}
      <EventEvidence event={event} group={group} project={project} />
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
      <EventReplay event={event} group={group} projectSlug={project.slug} />
      <GroupEventEntry entryType={EntryType.HPKP} {...eventEntryProps} />
      <GroupEventEntry entryType={EntryType.CSP} {...eventEntryProps} />
      <GroupEventEntry entryType={EntryType.EXPECTCT} {...eventEntryProps} />
      <GroupEventEntry entryType={EntryType.EXPECTSTAPLE} {...eventEntryProps} />
      <GroupEventEntry entryType={EntryType.TEMPLATE} {...eventEntryProps} />
      <GroupEventEntry entryType={EntryType.BREADCRUMBS} {...eventEntryProps} />
      {!showMaybeSolutionsHigher && (
        <ResourcesAndMaybeSolutions event={event} project={project} group={group} />
      )}
      <GroupEventEntry entryType={EntryType.DEBUGMETA} {...eventEntryProps} />
      <GroupEventEntry entryType={EntryType.REQUEST} {...eventEntryProps} />
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
          group={group}
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

function PerformanceDurationRegressionIssueDetailsContent({
  group,
  event,
  project,
}: Required<GroupEventDetailsContentProps>) {
  return (
    <Fragment>
      <ErrorBoundary mini>
        <EventRegressionSummary event={event} group={group} />
      </ErrorBoundary>
      <ErrorBoundary mini>
        <EventBreakpointChart event={event} />
      </ErrorBoundary>
      <ErrorBoundary mini>
        <AggregateSpanDiff event={event} project={project} />
      </ErrorBoundary>
      <ErrorBoundary mini>
        <EventComparison event={event} project={project} />
      </ErrorBoundary>
    </Fragment>
  );
}

function ProfilingDurationRegressionIssueDetailsContent({
  group,
  event,
  project,
}: Required<GroupEventDetailsContentProps>) {
  const organization = useOrganization();

  return (
    <TransactionsDeltaProvider event={event} project={project}>
      <Fragment>
        <ErrorBoundary mini>
          <EventRegressionSummary event={event} group={group} />
        </ErrorBoundary>
        <ErrorBoundary mini>
          <EventFunctionBreakpointChart event={event} />
        </ErrorBoundary>
        <ErrorBoundary mini>
          <EventAffectedTransactions event={event} group={group} project={project} />
        </ErrorBoundary>
        <Feature features="profiling-differential-flamegraph" organization={organization}>
          <ErrorBoundary mini>
            <DataSection>
              <b>{t('Largest Changes in Call Stack Frequency')}</b>
              <p>
                {t(`See which functions changed the most before and after the regression. The
                frame with the largest increase in call stack population likely
                contributed to the cause for the duration regression.`)}
              </p>

              <EventDifferentialFlamegraph event={event} />
            </DataSection>
          </ErrorBoundary>
        </Feature>
        <ErrorBoundary mini>
          <EventFunctionComparisonList event={event} group={group} project={project} />
        </ErrorBoundary>
      </Fragment>
    </TransactionsDeltaProvider>
  );
}

function GroupEventDetailsContent({
  group,
  event,
  project,
}: GroupEventDetailsContentProps) {
  if (!event) {
    return (
      <NotFoundMessage>
        <h3>{t('Latest event not available')}</h3>
      </NotFoundMessage>
    );
  }

  switch (group.issueType) {
    case IssueType.PERFORMANCE_DURATION_REGRESSION:
    case IssueType.PERFORMANCE_ENDPOINT_REGRESSION: {
      return (
        <PerformanceDurationRegressionIssueDetailsContent
          group={group}
          event={event}
          project={project}
        />
      );
    }
    case IssueType.PROFILE_FUNCTION_REGRESSION_EXPERIMENTAL:
    case IssueType.PROFILE_FUNCTION_REGRESSION: {
      return (
        <ProfilingDurationRegressionIssueDetailsContent
          group={group}
          event={event}
          project={project}
        />
      );
    }
    default: {
      return (
        <DefaultGroupEventDetailsContent group={group} event={event} project={project} />
      );
    }
  }
}

const NotFoundMessage = styled('div')`
  padding: ${space(2)} ${space(4)};
`;

export default GroupEventDetailsContent;
