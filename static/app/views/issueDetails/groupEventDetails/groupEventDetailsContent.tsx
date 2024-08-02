import {Fragment, lazy, useRef} from 'react';
import styled from '@emotion/styled';

import {usePrompt} from 'sentry/actionCreators/prompts';
import {Button} from 'sentry/components/button';
import {CommitRow} from 'sentry/components/commitRow';
import ErrorBoundary from 'sentry/components/errorBoundary';
import BreadcrumbsDataSection from 'sentry/components/events/breadcrumbs/breadcrumbsDataSection';
import {EventContexts} from 'sentry/components/events/contexts';
import {EventDevice} from 'sentry/components/events/device';
import {EventAttachments} from 'sentry/components/events/eventAttachments';
import {EventEntry} from 'sentry/components/events/eventEntry';
import {EventEvidence} from 'sentry/components/events/eventEvidence';
import {EventExtraData} from 'sentry/components/events/eventExtraData';
import EventHydrationDiff from 'sentry/components/events/eventHydrationDiff';
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
import {ScreenshotDataSection} from 'sentry/components/events/eventTagsAndScreenshot/screenshot/screenshotDataSection';
import EventTagsDataSection from 'sentry/components/events/eventTagsAndScreenshot/tags';
import {EventViewHierarchy} from 'sentry/components/events/eventViewHierarchy';
import {EventGroupingInfo} from 'sentry/components/events/groupingInfo';
import HighlightsDataSection from 'sentry/components/events/highlights/highlightsDataSection';
import {ActionableItems} from 'sentry/components/events/interfaces/crashContent/exception/actionableItems';
import {actionableItemsEnabled} from 'sentry/components/events/interfaces/crashContent/exception/useActionableItems';
import {CronTimelineSection} from 'sentry/components/events/interfaces/crons/cronTimelineSection';
import {AnrRootCause} from 'sentry/components/events/interfaces/performance/anrRootCause';
import {SpanEvidenceSection} from 'sentry/components/events/interfaces/performance/spanEvidence';
import {UptimeDataSection} from 'sentry/components/events/interfaces/uptime/uptimeDataSection';
import {EventPackageData} from 'sentry/components/events/packageData';
import {EventRRWebIntegration} from 'sentry/components/events/rrwebIntegration';
import {DataSection} from 'sentry/components/events/styles';
import {SuspectCommits} from 'sentry/components/events/suspectCommits';
import {EventUserFeedback} from 'sentry/components/events/userFeedback';
import LazyLoad from 'sentry/components/lazyLoad';
import Placeholder from 'sentry/components/placeholder';
import {useHasNewTimelineUI} from 'sentry/components/timeline/utils';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {EntryException, Event, EventTransaction} from 'sentry/types/event';
import {EntryType, EventOrGroupType} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import {IssueCategory, IssueType} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {shouldShowCustomErrorResourceConfig} from 'sentry/utils/issueTypeConfig';
import {QuickTraceContext} from 'sentry/utils/performance/quickTrace/quickTraceContext';
import QuickTraceQuery from 'sentry/utils/performance/quickTrace/quickTraceQuery';
import {getReplayIdFromEvent} from 'sentry/utils/replays/getReplayIdFromEvent';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {ResourcesAndPossibleSolutions} from 'sentry/views/issueDetails/resourcesAndPossibleSolutions';
import {EventFilter} from 'sentry/views/issueDetails/streamline/eventFilter';
import {EventNavigation} from 'sentry/views/issueDetails/streamline/eventNavigation';
import {FoldSectionKey, Section} from 'sentry/views/issueDetails/streamline/foldSection';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';
import {TraceTimeLineOrRelatedIssue} from 'sentry/views/issueDetails/traceTimelineOrRelatedIssue';
import {useHasStreamlinedUI} from 'sentry/views/issueDetails/utils';

const LLMMonitoringSection = lazy(
  () => import('sentry/components/events/interfaces/llm-monitoring/llmMonitoringSection')
);

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
  sectionKey: FoldSectionKey;
};

function GroupEventEntry({
  event,
  entryType,
  group,
  project,
  ...props
}: GroupEventEntryProps) {
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
      {...props}
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
  const hasNewTimelineUI = useHasNewTimelineUI();
  const hasStreamlinedUI = useHasStreamlinedUI();
  const tagsRef = useRef<HTMLDivElement>(null);

  const projectSlug = project.slug;
  const hasReplay = Boolean(getReplayIdFromEvent(event));
  const mechanism = event.tags?.find(({key}) => key === 'mechanism')?.value;
  const isANR = mechanism === 'ANR' || mechanism === 'AppExitInfo';
  const hasAnrImprovementsFeature = organization.features.includes('anr-improvements');
  const showPossibleSolutionsHigher = shouldShowCustomErrorResourceConfig(group, project);

  const eventEntryProps = {group, event, project};

  const hasActionableItems = actionableItemsEnabled({
    eventId: event.id,
    organization,
    projectSlug,
  });

  const {
    isLoading: promptLoading,
    isError: promptError,
    isPromptDismissed,
    dismissPrompt,
    showPrompt,
  } = usePrompt({
    feature: 'issue_feedback_hidden',
    organization,
    projectId: project.id,
  });

  // default to show on error or isPromptDismissed === undefined
  const showFeedback = !isPromptDismissed || promptError;

  return (
    <Fragment>
      {hasActionableItems && (
        <ActionableItems event={event} project={project} isShare={false} />
      )}
      <StyledDataSection>
        <TraceTimeLineOrRelatedIssue event={event} />
        <SuspectCommits
          project={project}
          eventId={event.id}
          group={group}
          commitRow={CommitRow}
        />
      </StyledDataSection>
      {event.userReport && (
        <InterimSection
          title={t('User Feedback')}
          type={FoldSectionKey.USER_FEEDBACK}
          actions={
            hasStreamlinedUI ? null : (
              <ErrorBoundary mini>
                <Button
                  size="xs"
                  icon={<IconChevron direction={showFeedback ? 'up' : 'down'} />}
                  onClick={showFeedback ? dismissPrompt : showPrompt}
                  title={
                    showFeedback
                      ? t('Hide feedback on all issue details')
                      : t('Unhide feedback on all issue details')
                  }
                  disabled={promptError}
                  busy={promptLoading}
                >
                  {showFeedback ? t('Hide') : t('Show')}
                </Button>
              </ErrorBoundary>
            )
          }
        >
          {promptLoading ? (
            <Placeholder />
          ) : showFeedback ? (
            <EventUserFeedback
              report={event.userReport}
              orgSlug={organization.slug}
              issueId={group.id}
              showEventLink={false}
            />
          ) : null}
        </InterimSection>
      )}
      {event.type === EventOrGroupType.ERROR &&
      organization.features.includes('insights-addon-modules') &&
      event?.entries
        ?.filter((x): x is EntryException => x.type === EntryType.EXCEPTION)
        .flatMap(x => x.data.values ?? [])
        .some(({value}) => {
          const lowerText = value?.toLowerCase();
          return (
            lowerText &&
            (lowerText.includes('api key') || lowerText.includes('429')) &&
            (lowerText.includes('openai') ||
              lowerText.includes('anthropic') ||
              lowerText.includes('cohere') ||
              lowerText.includes('langchain'))
          );
        }) ? (
        <LazyLoad
          LazyComponent={LLMMonitoringSection}
          event={event}
          organization={organization}
        />
      ) : null}
      {group.issueCategory === IssueCategory.UPTIME && (
        <UptimeDataSection group={group} />
      )}
      {group.issueCategory === IssueCategory.CRON && (
        <CronTimelineSection
          event={event}
          organization={organization}
          project={project}
        />
      )}
      <HighlightsDataSection event={event} project={project} viewAllRef={tagsRef} />
      {showPossibleSolutionsHigher && (
        <ResourcesAndPossibleSolutionsIssueDetailsContent
          event={event}
          project={project}
          group={group}
        />
      )}
      <EventEvidence event={event} group={group} project={project} />
      <GroupEventEntry
        sectionKey={FoldSectionKey.MESSAGE}
        entryType={EntryType.MESSAGE}
        {...eventEntryProps}
      />
      <GroupEventEntry
        sectionKey={FoldSectionKey.STACKTRACE}
        entryType={EntryType.EXCEPTION}
        {...eventEntryProps}
      />
      <GroupEventEntry
        sectionKey={FoldSectionKey.STACKTRACE}
        entryType={EntryType.STACKTRACE}
        {...eventEntryProps}
      />
      <GroupEventEntry
        sectionKey={FoldSectionKey.THREADS}
        entryType={EntryType.THREADS}
        {...eventEntryProps}
      />
      {hasAnrImprovementsFeature && isANR && (
        <QuickTraceQuery
          event={event}
          location={location}
          orgSlug={organization.slug}
          type={'spans'}
          skipLight
        >
          {results => {
            return (
              <QuickTraceContext.Provider value={results}>
                <AnrRootCause event={event} organization={organization} />
              </QuickTraceContext.Provider>
            );
          }}
        </QuickTraceQuery>
      )}
      {group.issueCategory === IssueCategory.PERFORMANCE && (
        <SpanEvidenceSection
          event={event as EventTransaction}
          organization={organization}
          projectSlug={project.slug}
        />
      )}
      <EventHydrationDiff event={event} group={group} />
      <EventReplay event={event} group={group} projectSlug={project.slug} />
      <GroupEventEntry
        sectionKey={FoldSectionKey.HPKP}
        entryType={EntryType.HPKP}
        {...eventEntryProps}
      />
      <GroupEventEntry
        sectionKey={FoldSectionKey.CSP}
        entryType={EntryType.CSP}
        {...eventEntryProps}
      />
      <GroupEventEntry
        sectionKey={FoldSectionKey.EXPECTCT}
        entryType={EntryType.EXPECTCT}
        {...eventEntryProps}
      />
      <GroupEventEntry
        sectionKey={FoldSectionKey.EXPECTCT}
        entryType={EntryType.EXPECTSTAPLE}
        {...eventEntryProps}
      />
      <GroupEventEntry
        sectionKey={FoldSectionKey.TEMPLATE}
        entryType={EntryType.TEMPLATE}
        {...eventEntryProps}
      />
      {hasNewTimelineUI ? (
        <BreadcrumbsDataSection event={event} group={group} project={project} />
      ) : (
        <GroupEventEntry
          sectionKey={FoldSectionKey.BREADCRUMBS}
          entryType={EntryType.BREADCRUMBS}
          {...eventEntryProps}
        />
      )}
      {!showPossibleSolutionsHigher && (
        <ResourcesAndPossibleSolutionsIssueDetailsContent
          event={event}
          project={project}
          group={group}
        />
      )}
      <GroupEventEntry
        sectionKey={FoldSectionKey.DEBUGMETA}
        entryType={EntryType.DEBUGMETA}
        {...eventEntryProps}
      />
      <GroupEventEntry
        sectionKey={FoldSectionKey.REQUEST}
        entryType={EntryType.REQUEST}
        {...eventEntryProps}
      />
      {hasStreamlinedUI ? (
        <EventTagsDataSection event={event} projectSlug={project.slug} ref={tagsRef} />
      ) : (
        <div ref={tagsRef}>
          <EventTagsAndScreenshot event={event} projectSlug={project.slug} />
        </div>
      )}
      <EventContexts group={group} event={event} />
      <EventExtraData event={event} />
      <EventPackageData event={event} />
      <EventDevice event={event} />
      <EventViewHierarchy event={event} project={project} />
      {hasStreamlinedUI && (
        <ScreenshotDataSection event={event} projectSlug={project.slug} />
      )}
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

function ResourcesAndPossibleSolutionsIssueDetailsContent({
  event,
  project,
  group,
}: Required<GroupEventDetailsContentProps>) {
  return (
    <ErrorBoundary mini>
      <ResourcesAndPossibleSolutions event={event} project={project} group={group} />
    </ErrorBoundary>
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
        {!organization.features.includes('continuous-profiling-compat') && (
          <ErrorBoundary mini>
            <EventAffectedTransactions event={event} group={group} project={project} />
          </ErrorBoundary>
        )}
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
        <ErrorBoundary mini>
          <EventFunctionComparisonList event={event} group={group} project={project} />
        </ErrorBoundary>
      </Fragment>
    </TransactionsDeltaProvider>
  );
}

export default function GroupEventDetailsContent({
  group,
  event,
  project,
}: GroupEventDetailsContentProps) {
  const hasStreamlinedUI = useHasStreamlinedUI();
  const navRef = useRef<HTMLDivElement>(null);

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
      return hasStreamlinedUI ? (
        <Fragment>
          <EventFilter />
          <GroupContent navHeight={navRef?.current?.offsetHeight}>
            <FloatingEventNavigation event={event} group={group} ref={navRef} />
            <GroupContentPadding>
              <DefaultGroupEventDetailsContent
                group={group}
                event={event}
                project={project}
              />
            </GroupContentPadding>
          </GroupContent>
        </Fragment>
      ) : (
        <DefaultGroupEventDetailsContent group={group} event={event} project={project} />
      );
    }
  }
}

const NotFoundMessage = styled('div')`
  padding: ${space(2)} ${space(4)};
`;

const StyledDataSection = styled(DataSection)`
  padding: ${space(0.5)} ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    padding: ${space(1)} ${space(4)};
  }

  &:empty {
    display: none;
  }
`;

const FloatingEventNavigation = styled(EventNavigation)`
  position: sticky;
  top: 0;
  background: ${p => p.theme.background};
  z-index: 100;
  border-radius: 6px 6px 0 0;
`;

const GroupContent = styled('div')<{navHeight?: number}>`
  border: 1px solid ${p => p.theme.border};
  background: ${p => p.theme.background};
  border-radius: ${p => p.theme.borderRadius};
  position: relative;
  & ${Section} {
    scroll-margin-top: ${p => p.navHeight ?? 0}px;
  }
`;

const GroupContentPadding = styled('div')`
  padding: ${space(1)} ${space(1.5)};
`;
