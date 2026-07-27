import {Fragment, useMemo, useRef} from 'react';

import Feature from 'sentry/components/acl/feature';
import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {BreadcrumbsDataSection} from 'sentry/components/events/breadcrumbs/breadcrumbsDataSection';
import {EventContexts} from 'sentry/components/events/contexts';
import {EventDevice} from 'sentry/components/events/device';
import {EventAttachments} from 'sentry/components/events/eventAttachments';
import {EventDataSection} from 'sentry/components/events/eventDataSection';
import {EventEvidence} from 'sentry/components/events/eventEvidence';
import {EventExtraData} from 'sentry/components/events/eventExtraData';
import {EventHydrationDiff} from 'sentry/components/events/eventHydrationDiff';
import {EventInsightDiff} from 'sentry/components/events/eventInsightDiff';
import {EventProcessingErrors} from 'sentry/components/events/eventProcessingErrors';
import {EventReplay} from 'sentry/components/events/eventReplay';
import {EventSdk} from 'sentry/components/events/eventSdk';
import {AggregateSpanDiff} from 'sentry/components/events/eventStatisticalDetector/aggregateSpanDiff';
import {EventBreakpointChart} from 'sentry/components/events/eventStatisticalDetector/breakpointChart';
import {EventComparison} from 'sentry/components/events/eventStatisticalDetector/eventComparison';
import {EventDifferentialFlamegraph} from 'sentry/components/events/eventStatisticalDetector/eventDifferentialFlamegraph';
import {EventRegressionSummary} from 'sentry/components/events/eventStatisticalDetector/eventRegressionSummary';
import {EventFunctionBreakpointChart} from 'sentry/components/events/eventStatisticalDetector/functionBreakpointChart';
import {ScreenshotDataSection} from 'sentry/components/events/eventTagsAndScreenshot/screenshot/screenshotDataSection';
import {EventTagsDataSection} from 'sentry/components/events/eventTagsAndScreenshot/tags';
import {EventViewHierarchy} from 'sentry/components/events/eventViewHierarchy';
import {EventXrayDiff} from 'sentry/components/events/eventXrayDiff';
import {EventFeatureFlagSection} from 'sentry/components/events/featureFlags/eventFeatureFlagSection';
import {EventGroupingInfoSection} from 'sentry/components/events/groupingInfo/groupingInfoSection';
import {HighlightsDataSection} from 'sentry/components/events/highlights/highlightsDataSection';
import {HighlightsIconSummary} from 'sentry/components/events/highlights/highlightsIconSummary';
import {
  AndroidNativeTombstonesBanner,
  shouldShowTombstonesBanner,
} from 'sentry/components/events/interfaces/crashContent/exception/androidNativeTombstonesBanner';
import {Csp} from 'sentry/components/events/interfaces/csp';
import {DebugMeta} from 'sentry/components/events/interfaces/debugMeta';
import {DebugMetaSearchProvider} from 'sentry/components/events/interfaces/debugMeta/debugMetaSearchContext';
import {ProguardSection} from 'sentry/components/events/interfaces/debugMeta/proguardSection';
import {Exception} from 'sentry/components/events/interfaces/exception';
import {Message} from 'sentry/components/events/interfaces/message';
import {AnrRootCause} from 'sentry/components/events/interfaces/performance/anrRootCause';
import {EventTraceView} from 'sentry/components/events/interfaces/performance/eventTraceView';
import {SpanEvidenceSection} from 'sentry/components/events/interfaces/performance/spanEvidence';
import {TRACE_WATERFALL_PREFERENCES_KEY} from 'sentry/components/events/interfaces/performance/utils';
import {Request} from 'sentry/components/events/interfaces/request';
import {StackTrace} from 'sentry/components/events/interfaces/stackTrace';
import {Template} from 'sentry/components/events/interfaces/template';
import {Threads} from 'sentry/components/events/interfaces/threads';
import {UptimeAssertionsSection} from 'sentry/components/events/interfaces/uptime/uptimeAssertionsSection';
import {MetricsSection} from 'sentry/components/events/metrics/metricsSection';
import {OurlogsSection} from 'sentry/components/events/ourlogs/ourlogsSection';
import {EventPackageData} from 'sentry/components/events/packageData';
import {EventRRWebIntegration} from 'sentry/components/events/rrwebIntegration';
import {EventUserFeedback} from 'sentry/components/events/userFeedback';
import {IssueStackTrace} from 'sentry/components/stackTrace/issueStackTrace';
import {t} from 'sentry/locale';
import type {Entry, EntryMap, Event, EventTransaction} from 'sentry/types/event';
import {EntryType} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import {IssueType} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils/defined';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import {
  isJavascriptPlatform,
  isMobilePlatform,
  isNativePlatform,
} from 'sentry/utils/platform';
import {getReplayIdFromEvent} from 'sentry/utils/replays/getReplayIdFromEvent';
import {useOrganization} from 'sentry/utils/useOrganization';
import {LowValueSpanProblemSection} from 'sentry/views/issueDetails/configurationIssues/lowValueSpanIssues/lowValueSpanProblemSection';
import {LowValueSpanTroubleshootingSection} from 'sentry/views/issueDetails/configurationIssues/lowValueSpanIssues/lowValueSpanTroubleshootingSection';
import {SourceMapIssueDetails} from 'sentry/views/issueDetails/configurationIssues/sourceMapIssues/sourceMapIssueDetails';
import {SectionKey} from 'sentry/views/issueDetails/context';
import {EventDetails} from 'sentry/views/issueDetails/eventDetails';
import {FoldSection} from 'sentry/views/issueDetails/foldSection';
import {useCopyIssueDetails} from 'sentry/views/issueDetails/hooks/useCopyIssueDetails';
import {
  getHangProfileData,
  MetricKitHangProfileSection,
} from 'sentry/views/issueDetails/metricKitHangProfileSection';
import {ProfilePreviewSection} from 'sentry/views/issueDetails/profilePreviewSection';
import {MetricDetectorTriggeredSection} from 'sentry/views/issueDetails/sidebar/metricDetectorTriggeredSection';
import {SizeAnalysisTriggeredSection} from 'sentry/views/issueDetails/sidebar/sizeAnalysisTriggeredSection';
import {useIsSampleEvent} from 'sentry/views/issueDetails/utils';
import {DEFAULT_TRACE_VIEW_PREFERENCES} from 'sentry/views/performance/newTraceDetails/traceState/tracePreferences';
import {TraceStateProvider} from 'sentry/views/performance/newTraceDetails/traceState/traceStateProvider';

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
  const shouldUseNewStackTrace =
    // New stack trace is currently only non-native platforms.
    !isNativePlatform(event.platform);
  const tagsRef = useRef<HTMLDivElement>(null);
  const eventEntries = useMemo(() => {
    const {entries} = event;
    return entries.reduce<Partial<EntryMap>>((entryMap, entry) => {
      (entryMap as Record<string, Entry>)[entry.type] = entry;
      return entryMap;
    }, {});
  }, [event]);

  const projectSlug = project.slug;
  const hasReplay = Boolean(getReplayIdFromEvent(event));
  const mechanism = event.tags?.find(({key}) => key === 'mechanism')?.value;
  const isANR = mechanism === 'ANR' || mechanism === 'AppExitInfo';
  const hangProfileData =
    mechanism === 'mx_hang_diagnostic' ? getHangProfileData(event) : null;
  const isMetricKitHang = hangProfileData !== null;
  const groupingCurrentLevel = group?.metadata?.current_level;
  const isSampleError = useIsSampleEvent();

  useCopyIssueDetails(group, event);

  const issueTypeConfig = getConfigForIssueType(group, group.project);

  if (group.issueType === IssueType.SOURCEMAP_CONFIGURATION) {
    return <SourceMapIssueDetails event={event} project={project} />;
  }

  return (
    <DebugMetaSearchProvider key={event.id}>
      <ErrorBoundary mini>
        <HighlightsIconSummary event={event} group={group} />
      </ErrorBoundary>
      {issueTypeConfig.tags.enabled && (
        <HighlightsDataSection event={event} project={project} />
      )}
      {isMobilePlatform(project.platform) && (
        <ProfilePreviewSection event={event} project={project} />
      )}
      {event.userReport && (
        <FoldSection title={t('User Feedback')} sectionKey={SectionKey.USER_FEEDBACK}>
          <EventUserFeedback report={event.userReport} />
        </FoldSection>
      )}
      {issueTypeConfig.configurationProblem.enabled && (
        <FoldSection sectionKey={SectionKey.CONFIGURATION_PROBLEM} title={t('Problem')}>
          {/* Low-value spans is the only consumer of configurationProblem today;
              the implementation will be generalized once more configuration
              issues opt into this flag. */}
          <LowValueSpanProblemSection event={event} />
        </FoldSection>
      )}
      {issueTypeConfig.configurationTroubleshooting.enabled && (
        <FoldSection
          sectionKey={SectionKey.CONFIGURATION_TROUBLESHOOTING}
          title={t('Troubleshooting')}
        >
          {/* Low-value spans is the only consumer of configurationTroubleshooting
              today; the implementation will be generalized once more
              configuration issues opt into this flag. */}
          <LowValueSpanTroubleshootingSection event={event} project={project} />
        </FoldSection>
      )}
      <EventEvidence event={event} group={group} project={project} />
      {group.issueType === IssueType.UPTIME_DOMAIN_FAILURE && (
        <UptimeAssertionsSection event={event} />
      )}
      {defined(eventEntries[EntryType.MESSAGE]) && (
        <EntryErrorBoundary type={EntryType.MESSAGE}>
          <Message event={event} data={eventEntries[EntryType.MESSAGE].data} />
        </EntryErrorBoundary>
      )}
      {isMetricKitHang ? (
        <MetricKitHangProfileSection data={hangProfileData} />
      ) : (
        <Fragment>
          {shouldShowTombstonesBanner(event) && !isSampleError && (
            <ErrorBoundary mini>
              <AndroidNativeTombstonesBanner
                event={event}
                projectId={group?.project.id ?? event.projectID ?? ''}
              />
            </ErrorBoundary>
          )}
          {defined(eventEntries[EntryType.EXCEPTION]) && (
            <EntryErrorBoundary type={EntryType.EXCEPTION}>
              {shouldUseNewStackTrace ? (
                <IssueStackTrace
                  event={event}
                  values={eventEntries[EntryType.EXCEPTION].data.values ?? []}
                  projectSlug={project.slug}
                  group={group}
                />
              ) : (
                <Exception
                  event={event}
                  data={eventEntries[EntryType.EXCEPTION].data}
                  projectSlug={project.slug}
                  group={group}
                  groupingCurrentLevel={groupingCurrentLevel}
                />
              )}
            </EntryErrorBoundary>
          )}
          {issueTypeConfig.stacktrace.enabled &&
            defined(eventEntries[EntryType.STACKTRACE]) && (
              <EntryErrorBoundary type={EntryType.STACKTRACE}>
                {shouldUseNewStackTrace ? (
                  <IssueStackTrace
                    event={event}
                    stacktrace={eventEntries[EntryType.STACKTRACE].data}
                    projectSlug={projectSlug}
                    group={group}
                  />
                ) : (
                  <StackTrace
                    event={event}
                    data={eventEntries[EntryType.STACKTRACE].data}
                    projectSlug={projectSlug}
                    groupingCurrentLevel={groupingCurrentLevel}
                  />
                )}
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
        </Fragment>
      )}
      <ScreenshotDataSection event={event} projectSlug={project.slug} />
      {isANR && (
        <TraceStateProvider
          initialPreferences={DEFAULT_TRACE_VIEW_PREFERENCES}
          preferencesStorageKey={TRACE_WATERFALL_PREFERENCES_KEY}
        >
          <AnrRootCause event={event} organization={organization} />
        </TraceStateProvider>
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
            <FoldSection
              sectionKey={SectionKey.REGRESSION_FLAMEGRAPH}
              title={t('Regression Flamegraph')}
            >
              <b>{t('Largest Changes in Call Stack Frequency')}</b>
              <p>
                {t(`See which functions changed the most before and after the regression. The
            frame with the largest increase in call stack population likely
            contributed to the cause for the duration regression.`)}
              </p>
              <EventDifferentialFlamegraph event={event} />
            </FoldSection>
          </ErrorBoundary>
        </Fragment>
      )}
      <ErrorBoundary customComponent={() => null}>
        <MetricDetectorTriggeredSection group={group} event={event} />
      </ErrorBoundary>
      <ErrorBoundary customComponent={() => null}>
        <SizeAnalysisTriggeredSection event={event} />
      </ErrorBoundary>
      <EventHydrationDiff event={event} group={group} />
      <EventReplay event={event} group={group} projectSlug={project.slug} />
      {defined(eventEntries[EntryType.CSP]) && (
        <EntryErrorBoundary type={EntryType.CSP}>
          <Csp event={event} data={eventEntries[EntryType.CSP].data} />
        </EntryErrorBoundary>
      )}
      {defined(eventEntries[EntryType.TEMPLATE]) && (
        <EntryErrorBoundary type={EntryType.TEMPLATE}>
          <Template event={event} data={eventEntries[EntryType.TEMPLATE].data} />
        </EntryErrorBoundary>
      )}
      <BreadcrumbsDataSection event={event} group={group} project={project} />
      <ErrorBoundary mini message={t('There was a problem loading logs.')}>
        <Feature features="ourlogs-enabled" organization={organization}>
          <OurlogsSection event={event} group={group} project={project} />
        </Feature>
      </ErrorBoundary>
      <ErrorBoundary mini message={t('There was a problem loading metrics.')}>
        <Feature features="tracemetrics-enabled" organization={organization}>
          <MetricsSection event={event} group={group} project={project} />
        </Feature>
      </ErrorBoundary>
      {issueTypeConfig.trace.enabled &&
        event.contexts.trace?.trace_id &&
        organization.features.includes('performance-view') && (
          <EventTraceView group={group} event={event} organization={organization} />
        )}
      {defined(eventEntries[EntryType.REQUEST]) && (
        <EntryErrorBoundary type={EntryType.REQUEST}>
          <Request event={event} data={eventEntries[EntryType.REQUEST].data} />
        </EntryErrorBoundary>
      )}
      {issueTypeConfig.tags.enabled ? (
        <Fragment>
          <EventTagsDataSection event={event} projectSlug={project.slug} ref={tagsRef} />
        </Fragment>
      ) : null}
      {issueTypeConfig.contexts.enabled && <EventContexts event={event} />}
      <ErrorBoundary mini message={t('There was a problem loading feature flags.')}>
        <EventFeatureFlagSection group={group} project={project} event={event} />
      </ErrorBoundary>
      <EventExtraData event={event} />
      <EventViewHierarchy event={event} project={project} />
      <EventInsightDiff event={event} project={project} />
      <EventXrayDiff event={event} project={project} />
      <EventPackageData event={event} />
      <EventDevice event={event} />
      <EventAttachments event={event} project={project} group={group} />
      <EventSdk sdk={event.sdk} meta={event._meta?.sdk} />
      <EventProcessingErrors event={event} project={project} isShare={false} />
      {defined(eventEntries[EntryType.DEBUGMETA]) &&
        !isJavascriptPlatform(event.platform) && (
          <EntryErrorBoundary type={EntryType.DEBUGMETA}>
            <DebugMeta
              event={event}
              projectSlug={projectSlug}
              groupId={group?.id}
              data={eventEntries[EntryType.DEBUGMETA].data}
            />
            <ProguardSection
              data={eventEntries[EntryType.DEBUGMETA].data}
              projectSlug={projectSlug}
            />
          </EntryErrorBoundary>
        )}
      {event.groupID && issueTypeConfig.groupingInfo.enabled && (
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
    </DebugMetaSearchProvider>
  );
}

export function GroupEventDetailsContent({
  group,
  event,
  project,
}: EventDetailsContentProps) {
  return <EventDetails event={event} group={group} project={project} />;
}

/**
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
      customComponent={() => (
        <EventDataSection type={type} title={type}>
          <p>{t('There was an error rendering this data.')}</p>
        </EventDataSection>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}
