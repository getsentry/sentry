import {Fragment, lazy, useMemo, useRef} from 'react';
import {ClassNames} from '@emotion/react';
import styled from '@emotion/styled';

import {usePrompt} from 'sentry/actionCreators/prompts';
import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import {Button} from 'sentry/components/button';
import {CommitRow} from 'sentry/components/commitRow';
import ErrorBoundary from 'sentry/components/errorBoundary';
import BreadcrumbsDataSection from 'sentry/components/events/breadcrumbs/breadcrumbsDataSection';
import {EventContexts} from 'sentry/components/events/contexts';
import {EventDevice} from 'sentry/components/events/device';
import {EventAttachments} from 'sentry/components/events/eventAttachments';
import {EventDataSection} from 'sentry/components/events/eventDataSection';
import {EventEvidence} from 'sentry/components/events/eventEvidence';
import {EventExtraData} from 'sentry/components/events/eventExtraData';
import EventHydrationDiff from 'sentry/components/events/eventHydrationDiff';
import {EventProcessingErrors} from 'sentry/components/events/eventProcessingErrors';
import EventReplay from 'sentry/components/events/eventReplay';
import {EventSdk} from 'sentry/components/events/eventSdk';
import AggregateSpanDiff from 'sentry/components/events/eventStatisticalDetector/aggregateSpanDiff';
import EventBreakpointChart from 'sentry/components/events/eventStatisticalDetector/breakpointChart';
import EventComparison from 'sentry/components/events/eventStatisticalDetector/eventComparison';
import {EventDifferentialFlamegraph} from 'sentry/components/events/eventStatisticalDetector/eventDifferentialFlamegraph';
import {EventRegressionSummary} from 'sentry/components/events/eventStatisticalDetector/eventRegressionSummary';
import {EventFunctionBreakpointChart} from 'sentry/components/events/eventStatisticalDetector/functionBreakpointChart';
import {EventTagsAndScreenshot} from 'sentry/components/events/eventTagsAndScreenshot';
import {ScreenshotDataSection} from 'sentry/components/events/eventTagsAndScreenshot/screenshot/screenshotDataSection';
import EventTagsDataSection from 'sentry/components/events/eventTagsAndScreenshot/tags';
import {EventViewHierarchy} from 'sentry/components/events/eventViewHierarchy';
import {EventFeatureFlagList} from 'sentry/components/events/featureFlags/eventFeatureFlagList';
import {EventGroupingInfoSection} from 'sentry/components/events/groupingInfo/groupingInfoSection';
import HighlightsDataSection from 'sentry/components/events/highlights/highlightsDataSection';
import {HighlightsIconSummary} from 'sentry/components/events/highlights/highlightsIconSummary';
import {ActionableItems} from 'sentry/components/events/interfaces/crashContent/exception/actionableItems';
import {actionableItemsEnabled} from 'sentry/components/events/interfaces/crashContent/exception/useActionableItems';
import {CronTimelineSection} from 'sentry/components/events/interfaces/crons/cronTimelineSection';
import {Csp} from 'sentry/components/events/interfaces/csp';
import {DebugMeta} from 'sentry/components/events/interfaces/debugMeta';
import {Exception} from 'sentry/components/events/interfaces/exception';
import {Generic} from 'sentry/components/events/interfaces/generic';
import {Message} from 'sentry/components/events/interfaces/message';
import {AnrRootCause} from 'sentry/components/events/interfaces/performance/anrRootCause';
import {EventTraceView} from 'sentry/components/events/interfaces/performance/eventTraceView';
import {SpanEvidenceSection} from 'sentry/components/events/interfaces/performance/spanEvidence';
import {Request} from 'sentry/components/events/interfaces/request';
import {StackTrace} from 'sentry/components/events/interfaces/stackTrace';
import {Template} from 'sentry/components/events/interfaces/template';
import {Threads} from 'sentry/components/events/interfaces/threads';
import {UptimeDataSection} from 'sentry/components/events/interfaces/uptime/uptimeDataSection';
import {EventPackageData} from 'sentry/components/events/packageData';
import {EventRRWebIntegration} from 'sentry/components/events/rrwebIntegration';
import {DataSection} from 'sentry/components/events/styles';
import {SuspectCommits} from 'sentry/components/events/suspectCommits';
import {EventUserFeedback} from 'sentry/components/events/userFeedback';
import LazyLoad from 'sentry/components/lazyLoad';
import Placeholder from 'sentry/components/placeholder';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Entry, EntryException, Event, EventTransaction} from 'sentry/types/event';
import {EntryType, EventOrGroupType} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import {IssueCategory} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import {QuickTraceContext} from 'sentry/utils/performance/quickTrace/quickTraceContext';
import QuickTraceQuery from 'sentry/utils/performance/quickTrace/quickTraceQuery';
import {getReplayIdFromEvent} from 'sentry/utils/replays/getReplayIdFromEvent';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {EventDetails} from 'sentry/views/issueDetails/streamline/eventDetails';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';
import {TraceDataSection} from 'sentry/views/issueDetails/traceDataSection';
import {useHasStreamlinedUI} from 'sentry/views/issueDetails/utils';

import MetricIssuesSection from '../metricIssuesSection';

const LLMMonitoringSection = lazy(
  () => import('sentry/components/events/interfaces/llm-monitoring/llmMonitoringSection')
);

export interface EventDetailsContentProps {
  group: Group;
  project: Project;
  event?: Event;
}

export function EventDetailsContent({
  group,
  event,
  project,
}: Required<Pick<EventDetailsContentProps, 'group' | 'event' | 'project'>>) {
  const organization = useOrganization();
  const location = useLocation();
  const hasStreamlinedUI = useHasStreamlinedUI();
  const tagsRef = useRef<HTMLDivElement>(null);
  const eventEntries = useMemo(() => {
    const {entries = []} = event;
    return entries.reduce<{[key in EntryType]?: Entry}>((entryMap, entry) => {
      entryMap[entry.type] = entry;
      return entryMap;
    }, {});
  }, [event]);

  const projectSlug = project.slug;
  const hasReplay = Boolean(getReplayIdFromEvent(event));
  const mechanism = event.tags?.find(({key}) => key === 'mechanism')?.value;
  const isANR = mechanism === 'ANR' || mechanism === 'AppExitInfo';
  const groupingCurrentLevel = group?.metadata?.current_level;

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
  const showFeedback = !isPromptDismissed || promptError || hasStreamlinedUI;

  const issueTypeConfig = getConfigForIssueType(group, group.project);

  return (
    <Fragment>
      {hasStreamlinedUI && <HighlightsIconSummary event={event} group={group} />}
      {hasActionableItems && !hasStreamlinedUI && (
        <ActionableItems event={event} project={project} isShare={false} />
      )}
      {issueTypeConfig.tags.enabled && (
        <HighlightsDataSection event={event} project={project} viewAllRef={tagsRef} />
      )}
      <StyledDataSection>
        {!hasStreamlinedUI && <TraceDataSection event={event} />}
        {!hasStreamlinedUI && (
          <SuspectCommits
            projectSlug={project.slug}
            eventId={event.id}
            group={group}
            commitRow={CommitRow}
          />
        )}
      </StyledDataSection>
      {event.userReport && (
        <InterimSection
          title={t('User Feedback')}
          type={SectionKey.USER_FEEDBACK}
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

      {!hasStreamlinedUI && group.issueCategory === IssueCategory.UPTIME && (
        <UptimeDataSection event={event} project={project} group={group} />
      )}
      {group.issueCategory === IssueCategory.CRON && (
        <CronTimelineSection
          event={event}
          organization={organization}
          project={project}
        />
      )}
      {event.contexts?.metric_alert?.alert_rule_id && (
        <MetricIssuesSection
          organization={organization}
          group={group}
          event={event}
          project={project}
        />
      )}

      <EventEvidence event={event} group={group} project={project} />
      {defined(eventEntries[EntryType.MESSAGE]) && (
        <EntryErrorBoundary type={EntryType.MESSAGE}>
          <Message event={event} data={eventEntries[EntryType.MESSAGE].data} />
        </EntryErrorBoundary>
      )}
      {/* Wrapping all stacktrace components since multiple could appear */}
      <ClassNames>
        {({css}) => (
          <GuideAnchor
            target="stacktrace"
            position="top"
            disabled={
              !(
                defined(eventEntries[EntryType.EXCEPTION]) ||
                defined(eventEntries[EntryType.STACKTRACE]) ||
                defined(eventEntries[EntryType.THREADS])
              )
            }
            // Prevent the container span from shrinking the content
            containerClassName={css`
              display: block !important;
            `}
          >
            {defined(eventEntries[EntryType.EXCEPTION]) && (
              <EntryErrorBoundary type={EntryType.EXCEPTION}>
                <Exception
                  event={event}
                  data={eventEntries[EntryType.EXCEPTION].data}
                  projectSlug={project.slug}
                  group={group}
                  groupingCurrentLevel={groupingCurrentLevel}
                />
              </EntryErrorBoundary>
            )}
            {issueTypeConfig.stacktrace.enabled &&
              defined(eventEntries[EntryType.STACKTRACE]) && (
                <EntryErrorBoundary type={EntryType.STACKTRACE}>
                  <StackTrace
                    event={event}
                    data={eventEntries[EntryType.STACKTRACE].data}
                    projectSlug={projectSlug}
                    groupingCurrentLevel={groupingCurrentLevel}
                  />
                </EntryErrorBoundary>
              )}
            {defined(eventEntries[EntryType.THREADS]) && (
              <EntryErrorBoundary type={EntryType.THREADS}>
                <Threads
                  event={event}
                  data={eventEntries[EntryType.THREADS].data}
                  projectSlug={project.slug}
                  groupingCurrentLevel={groupingCurrentLevel}
                  group={group}
                />
              </EntryErrorBoundary>
            )}
          </GuideAnchor>
        )}
      </ClassNames>
      {defined(eventEntries[EntryType.DEBUGMETA]) && (
        <EntryErrorBoundary type={EntryType.DEBUGMETA}>
          <DebugMeta
            event={event}
            projectSlug={projectSlug}
            groupId={group?.id}
            data={eventEntries[EntryType.DEBUGMETA].data}
          />
        </EntryErrorBoundary>
      )}
      {hasStreamlinedUI && (
        <ScreenshotDataSection event={event} projectSlug={project.slug} />
      )}
      {isANR && (
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
      {issueTypeConfig.spanEvidence.enabled && (
        <SpanEvidenceSection
          event={event as EventTransaction}
          organization={organization}
          projectSlug={project.slug}
        />
      )}
      {issueTypeConfig.regression.enabled && (
        <ErrorBoundary mini>
          <EventRegressionSummary event={event} group={group} />
        </ErrorBoundary>
      )}
      {issueTypeConfig.performanceDurationRegression.enabled && (
        <Fragment>
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
      )}
      {issueTypeConfig.profilingDurationRegression.enabled && (
        <Fragment>
          <ErrorBoundary mini>
            <EventFunctionBreakpointChart event={event} />
          </ErrorBoundary>
          <ErrorBoundary mini>
            <InterimSection
              type={SectionKey.REGRESSION_FLAMEGRAPH}
              title={t('Regression Flamegraph')}
            >
              <b>{t('Largest Changes in Call Stack Frequency')}</b>
              <p>
                {t(`See which functions changed the most before and after the regression. The
            frame with the largest increase in call stack population likely
            contributed to the cause for the duration regression.`)}
              </p>
              <EventDifferentialFlamegraph event={event} />
            </InterimSection>
          </ErrorBoundary>
        </Fragment>
      )}
      <EventHydrationDiff event={event} group={group} />
      {issueTypeConfig.replays.enabled && (
        <EventReplay event={event} group={group} projectSlug={project.slug} />
      )}
      {defined(eventEntries[EntryType.HPKP]) && (
        <EntryErrorBoundary type={EntryType.HPKP}>
          <Generic
            type={EntryType.HPKP}
            data={eventEntries[EntryType.HPKP].data}
            meta={event._meta?.hpkp ?? {}}
          />
        </EntryErrorBoundary>
      )}
      {defined(eventEntries[EntryType.CSP]) && (
        <EntryErrorBoundary type={EntryType.CSP}>
          <Csp event={event} data={eventEntries[EntryType.CSP].data} />
        </EntryErrorBoundary>
      )}
      {defined(eventEntries[EntryType.EXPECTCT]) && (
        <EntryErrorBoundary type={EntryType.EXPECTCT}>
          <Generic
            type={EntryType.EXPECTCT}
            data={eventEntries[EntryType.EXPECTCT].data}
          />
        </EntryErrorBoundary>
      )}
      {defined(eventEntries[EntryType.EXPECTSTAPLE]) && (
        <EntryErrorBoundary type={EntryType.EXPECTSTAPLE}>
          <Generic
            type={EntryType.EXPECTSTAPLE}
            data={eventEntries[EntryType.EXPECTSTAPLE].data}
          />
        </EntryErrorBoundary>
      )}
      {defined(eventEntries[EntryType.TEMPLATE]) && (
        <EntryErrorBoundary type={EntryType.TEMPLATE}>
          <Template event={event} data={eventEntries[EntryType.TEMPLATE].data} />
        </EntryErrorBoundary>
      )}
      <BreadcrumbsDataSection event={event} group={group} project={project} />
      {hasStreamlinedUI && event.contexts.trace?.trace_id && (
        <EventTraceView group={group} event={event} organization={organization} />
      )}
      {defined(eventEntries[EntryType.REQUEST]) && (
        <EntryErrorBoundary type={EntryType.REQUEST}>
          <Request event={event} data={eventEntries[EntryType.REQUEST].data} />
        </EntryErrorBoundary>
      )}
      {issueTypeConfig.tags.enabled ? (
        <Fragment>
          {hasStreamlinedUI ? (
            <EventTagsDataSection
              event={event}
              projectSlug={project.slug}
              ref={tagsRef}
            />
          ) : (
            <div ref={tagsRef}>
              <EventTagsAndScreenshot event={event} projectSlug={project.slug} />
            </div>
          )}
        </Fragment>
      ) : null}
      <EventContexts group={group} event={event} />
      <ErrorBoundary mini message={t('There was a problem loading feature flags.')}>
        <EventFeatureFlagList group={group} project={project} event={event} />
      </ErrorBoundary>
      <EventExtraData event={event} />
      <EventPackageData event={event} />
      <EventDevice event={event} />
      <EventViewHierarchy event={event} project={project} />
      <EventAttachments event={event} project={project} group={group} />
      <EventSdk sdk={event.sdk} meta={event._meta?.sdk} />
      {hasStreamlinedUI && (
        <EventProcessingErrors event={event} project={project} isShare={false} />
      )}
      {event.groupID && (
        <EventGroupingInfoSection
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

export default function GroupEventDetailsContent({
  group,
  event,
  project,
}: EventDetailsContentProps) {
  const hasStreamlinedUI = useHasStreamlinedUI();

  if (hasStreamlinedUI) {
    return <EventDetails event={event} group={group} project={project} />;
  }

  if (!event) {
    return (
      <NotFoundMessage>
        <h3>{t('Latest event not available')}</h3>
      </NotFoundMessage>
    );
  }

  return <EventDetailsContent group={group} event={event} project={project} />;
}

/**
 * This component is only necessary while the streamlined UI is not in place.
 * The FoldSection by default wraps its children with an ErrorBoundary, preventing content
 * from crashing the whole page if an error occurs, but EventDataSection does not do this.
 */
function EntryErrorBoundary({
  children,
  type,
}: {
  children: React.ReactNode;
  type: EntryType;
}) {
  return (
    <ErrorBoundary
      customComponent={
        <EventDataSection type={type} title={type}>
          <p>{t('There was an error rendering this data.')}</p>
        </EventDataSection>
      }
    >
      {children}
    </ErrorBoundary>
  );
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
