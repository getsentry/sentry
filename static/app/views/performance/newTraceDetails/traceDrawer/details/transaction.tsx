import {createRef, Fragment, useLayoutEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import omit from 'lodash/omit';

import {Button} from 'sentry/components/button';
import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import {DateTime} from 'sentry/components/dateTime';
import {Chunk} from 'sentry/components/events/contexts/chunk';
import {EventAttachments} from 'sentry/components/events/eventAttachments';
import {
  isNotMarkMeasurement,
  isNotPerformanceScoreMeasurement,
  TraceEventCustomPerformanceMetric,
} from 'sentry/components/events/eventCustomPerformanceMetrics';
import {Entries} from 'sentry/components/events/eventEntries';
import {EventEvidence} from 'sentry/components/events/eventEvidence';
import {EventExtraData} from 'sentry/components/events/eventExtraData';
import {REPLAY_CLIP_OFFSETS} from 'sentry/components/events/eventReplay';
import ReplayClipPreview from 'sentry/components/events/eventReplay/replayClipPreview';
import {EventSdk} from 'sentry/components/events/eventSdk';
import NewTagsUI from 'sentry/components/events/eventTagsAndScreenshot/tags';
import {EventViewHierarchy} from 'sentry/components/events/eventViewHierarchy';
import {Breadcrumbs} from 'sentry/components/events/interfaces/breadcrumbs';
import {getFormattedTimeRangeWithLeadingAndTrailingZero} from 'sentry/components/events/interfaces/spans/utils';
import {generateStats} from 'sentry/components/events/opsBreakdown';
import {EventRRWebIntegration} from 'sentry/components/events/rrwebIntegration';
import FileSize from 'sentry/components/fileSize';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {LazyRender, type LazyRenderProps} from 'sentry/components/lazyRender';
import Link from 'sentry/components/links/link';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import PerformanceDuration from 'sentry/components/performanceDuration';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {Tooltip} from 'sentry/components/tooltip';
import {PAGE_URL_PARAM} from 'sentry/constants/pageFilters';
import {IconChevron, IconOpen} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {
  type EntryBreadcrumbs,
  EntryType,
  type EventTransaction,
  type Organization,
} from 'sentry/types';
import {objectIsEmpty} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getAnalyticsDataForEvent} from 'sentry/utils/events';
import getDynamicText from 'sentry/utils/getDynamicText';
import {WEB_VITAL_DETAILS} from 'sentry/utils/performance/vitals/constants';
import {generateProfileFlamechartRoute} from 'sentry/utils/profiling/routes';
import {getReplayIdFromEvent} from 'sentry/utils/replays/getReplayIdFromEvent';
import {useLocation} from 'sentry/utils/useLocation';
import useProjects from 'sentry/utils/useProjects';
import {isCustomMeasurement} from 'sentry/views/dashboards/utils';
import {CustomMetricsEventData} from 'sentry/views/metrics/customMetricsEventData';
import {useTransaction} from 'sentry/views/performance/newTraceDetails/traceApi/useTransaction';
import type {TraceTreeNodeDetailsProps} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceTreeNodeDetails';
import type {
  TraceTree,
  TraceTreeNode,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {getTraceTabTitle} from 'sentry/views/performance/newTraceDetails/traceState/traceTabs';
import {Row, Tags} from 'sentry/views/performance/traceDetails/styles';
import {transactionSummaryRouteWithQuery} from 'sentry/views/performance/transactionSummary/utils';

import {useTraceAverageTransactionDuration} from '../../traceApi/useTraceAverageTransactionDuration';

import {IssueList} from './issues/issues';
import {TraceDrawerComponents} from './styles';

function OpsBreakdown({event}: {event: EventTransaction}) {
  const [showingAll, setShowingAll] = useState(false);
  const breakdown = event && generateStats(event, {type: 'no_filter'});

  if (!breakdown) {
    return null;
  }

  const renderText = showingAll ? t('Show less') : t('Show more') + '...';

  return (
    breakdown && (
      <Row
        title={
          <TraceDrawerComponents.FlexBox style={{gap: '5px'}}>
            {t('Ops Breakdown')}
            <QuestionTooltip
              title={t('Applicable to the children of this event only')}
              size="xs"
            />
          </TraceDrawerComponents.FlexBox>
        }
      >
        <div style={{display: 'flex', flexDirection: 'column', gap: space(0.25)}}>
          {breakdown.slice(0, showingAll ? breakdown.length : 5).map(currOp => {
            const {name, percentage, totalInterval} = currOp;

            const operationName = typeof name === 'string' ? name : t('Other');
            const pctLabel = isFinite(percentage) ? Math.round(percentage * 100) : '∞';

            return (
              <div key={operationName}>
                {operationName}:{' '}
                <PerformanceDuration seconds={totalInterval} abbreviation /> ({pctLabel}%)
              </div>
            );
          })}
          {breakdown.length > 5 && (
            <a onClick={() => setShowingAll(prev => !prev)}>{renderText}</a>
          )}
        </div>
      </Row>
    )
  );
}

function BreadCrumbsSection({
  event,
  organization,
}: {
  event: EventTransaction;
  organization: Organization;
}) {
  const [showBreadCrumbs, setShowBreadCrumbs] = useState(false);
  const breadCrumbsContainerRef = createRef<HTMLDivElement>();

  useLayoutEffect(() => {
    setTimeout(() => {
      if (showBreadCrumbs) {
        breadCrumbsContainerRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'end',
        });
      }
    }, 100);
  }, [showBreadCrumbs, breadCrumbsContainerRef]);

  const matchingEntry: EntryBreadcrumbs | undefined = event?.entries?.find(
    (entry): entry is EntryBreadcrumbs => entry.type === EntryType.BREADCRUMBS
  );

  if (!matchingEntry) {
    return null;
  }

  const renderText = showBreadCrumbs ? t('Hide Breadcrumbs') : t('Show Breadcrumbs');
  const chevron = <IconChevron size="xs" direction={showBreadCrumbs ? 'up' : 'down'} />;
  return (
    <Fragment>
      <a
        style={{display: 'flex', alignItems: 'center', gap: space(0.5)}}
        onClick={() => {
          setShowBreadCrumbs(prev => !prev);
        }}
      >
        {renderText} {chevron}
      </a>
      <div ref={breadCrumbsContainerRef}>
        {showBreadCrumbs && (
          <Breadcrumbs
            hideTitle
            data={matchingEntry.data}
            event={event}
            organization={organization}
          />
        )}
      </div>
    </Fragment>
  );
}

function ReplaySection({
  event,
  organization,
}: {
  event: EventTransaction;
  organization: Organization;
}) {
  const replayId = getReplayIdFromEvent(event);
  const startTimestampMS =
    event && 'startTimestamp' in event ? event.startTimestamp * 1000 : undefined;
  const timeOfEvent = event.dateCreated ?? startTimestampMS ?? event.dateReceived;
  const eventTimestampMs = timeOfEvent ? Math.floor(new Date(timeOfEvent).getTime()) : 0;

  return replayId ? (
    <ReplaySectionContainer>
      <ReplaySectionTitle>{t('Session Replay')}</ReplaySectionTitle>
      <ReplayClipPreview
        analyticsContext="trace-view"
        replaySlug={replayId}
        orgSlug={organization.slug}
        eventTimestampMs={eventTimestampMs}
        clipOffsets={REPLAY_CLIP_OFFSETS}
        fullReplayButtonProps={{
          analyticsEventKey: 'trace-view.drawer-open-replay-details-clicked',
          analyticsEventName: 'Trace View: Open Replay Details Clicked',
          analyticsParams: {
            ...getAnalyticsDataForEvent(event),
            organization,
          },
        }}
      />
    </ReplaySectionContainer>
  ) : null;
}

function AdditionalMobileEventContexts({event}: {event: EventTransaction}) {
  if (!event.contexts) {
    return null;
  }
  return (
    <Fragment>
      {Object.entries(omit(event.contexts ?? {}, ['feedback', 'response'])).map(
        ([key, value]) => {
          // Ignore profile as it's handled separately in the drawer.
          if (key === 'profile') {
            return null;
          }

          return (
            <Chunk
              key={key}
              type={value?.type ?? ''}
              alias={key}
              group={undefined}
              event={event}
              value={value}
            />
          );
        }
      )}
    </Fragment>
  );
}

const LAZY_RENDER_PROPS: Partial<LazyRenderProps> = {
  observerOptions: {rootMargin: '50px'},
};

export function TransactionNodeDetails({
  node,
  organization,
  onTabScrollToNode,
  onParentClick,
}: TraceTreeNodeDetailsProps<TraceTreeNode<TraceTree.Transaction>>) {
  const location = useLocation();
  const {projects} = useProjects();
  const issues = useMemo(() => {
    return [...node.errors, ...node.performance_issues];
  }, [node.errors, node.performance_issues]);

  const {data: averageDurationQueryResult} = useTraceAverageTransactionDuration({
    node,
    location,
    organization,
  });

  const avgDurationInSeconds: number = useMemo(() => {
    return (
      Number(averageDurationQueryResult?.data?.[0]?.['avg(transaction.duration)']) / 1000
    );
  }, [averageDurationQueryResult]);

  const {
    data: event,
    isError,
    isLoading,
  } = useTransaction({
    node,
    organization,
  });

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError message={t('Failed to fetch transaction details')} />;
  }

  const project = projects.find(proj => proj.slug === event?.projectSlug);
  const startTimestamp = Math.min(node.value.start_timestamp, node.value.timestamp);
  const endTimestamp = Math.max(node.value.start_timestamp, node.value.timestamp);

  const {start: startTimeWithLeadingZero, end: endTimeWithLeadingZero} =
    getFormattedTimeRangeWithLeadingAndTrailingZero(startTimestamp, endTimestamp);

  const durationInSeconds = endTimestamp - startTimestamp;

  const measurementNames = Object.keys(node.value.measurements ?? {})
    .filter(name => isCustomMeasurement(`measurements.${name}`))
    .filter(isNotMarkMeasurement)
    .filter(isNotPerformanceScoreMeasurement)
    .sort();

  const measurementKeys = Object.keys(event?.measurements ?? {})
    .filter(name => Boolean(WEB_VITAL_DETAILS[`measurements.${name}`]))
    .sort();

  const parentTransaction = node.parent_transaction;

  return (
    <TraceDrawerComponents.DetailContainer>
      <TraceDrawerComponents.HeaderContainer>
        <TraceDrawerComponents.Title>
          <Tooltip title={node.value.project_slug}>
            <ProjectBadge
              project={project ? project : {slug: node.value.project_slug}}
              avatarSize={30}
              hideName
            />
          </Tooltip>
          <TraceDrawerComponents.TitleText>
            <div>{t('transaction')}</div>
            <TraceDrawerComponents.TitleOp onClick={_e => onTabScrollToNode(node)}>
              {' '}
              {node.value['transaction.op'] + ' - ' + node.value.transaction}
            </TraceDrawerComponents.TitleOp>
          </TraceDrawerComponents.TitleText>
        </TraceDrawerComponents.Title>
        <TraceDrawerComponents.Actions>
          <TraceDrawerComponents.EventDetailsLink
            node={node}
            organization={organization}
          />
          <Button
            size="xs"
            icon={<IconOpen />}
            href={`/api/0/projects/${organization.slug}/${node.value.project_slug}/events/${node.value.event_id}/json/`}
            external
          >
            {t('JSON')} (<FileSize bytes={event?.size} />)
          </Button>
        </TraceDrawerComponents.Actions>
      </TraceDrawerComponents.HeaderContainer>

      <IssueList node={node} organization={organization} issues={issues} />

      <TraceDrawerComponents.Table className="table key-value">
        <tbody>
          <Row title="Duration">
            <TraceDrawerComponents.Duration
              duration={durationInSeconds}
              baseline={avgDurationInSeconds}
              baseDescription={
                'Average duration for this transaction over the last 24 hours'
              }
            />
          </Row>
          {parentTransaction ? (
            <Row title="Parent Transaction">
              <td className="value">
                <a onClick={() => onParentClick(parentTransaction)}>
                  {getTraceTabTitle(parentTransaction)}
                </a>
              </td>
            </Row>
          ) : null}
          <Row title={t('Event ID')}>
            {node.value.event_id}
            <CopyToClipboardButton
              borderless
              size="zero"
              iconSize="xs"
              text={node.value.event_id}
            />
          </Row>
          <Row title={t('Description')}>
            <Link
              to={transactionSummaryRouteWithQuery({
                orgSlug: organization.slug,
                transaction: node.value.transaction,
                query: omit(location.query, Object.values(PAGE_URL_PARAM)),
                projectID: String(node.value.project_id),
              })}
            >
              {node.value.transaction}
            </Link>
          </Row>
          {node.value.profile_id ? (
            <Row
              title="Profile ID"
              extra={
                <TraceDrawerComponents.Button
                  size="xs"
                  to={generateProfileFlamechartRoute({
                    orgSlug: organization.slug,
                    projectSlug: node.value.project_slug,
                    profileId: node.value.profile_id,
                  })}
                  onClick={function handleOnClick() {
                    trackAnalytics('profiling_views.go_to_flamegraph', {
                      organization,
                      source: 'performance.trace_view',
                    });
                  }}
                >
                  {t('View Profile')}
                </TraceDrawerComponents.Button>
              }
            >
              {node.value.profile_id}
            </Row>
          ) : null}
          <Row title="Date Range">
            {getDynamicText({
              fixed: 'Mar 19, 2021 11:06:27 AM UTC',
              value: (
                <Fragment>
                  <DateTime date={startTimestamp * node.multiplier} />
                  {` (${startTimeWithLeadingZero})`}
                </Fragment>
              ),
            })}
            <br />
            {getDynamicText({
              fixed: 'Mar 19, 2021 11:06:28 AM UTC',
              value: (
                <Fragment>
                  <DateTime date={endTimestamp * node.multiplier} />
                  {` (${endTimeWithLeadingZero})`}
                </Fragment>
              ),
            })}
          </Row>

          <OpsBreakdown event={event} />

          {!event || !event.measurements || measurementKeys.length <= 0 ? null : (
            <Fragment>
              {measurementKeys.map(measurement => (
                <Row
                  key={measurement}
                  title={WEB_VITAL_DETAILS[`measurements.${measurement}`]?.name}
                >
                  <PerformanceDuration
                    milliseconds={Number(
                      event.measurements?.[measurement].value.toFixed(3)
                    )}
                    abbreviation
                  />
                </Row>
              ))}
            </Fragment>
          )}

          {measurementNames.length > 0 && (
            <tr>
              <td className="key">{t('Measurements')}</td>
              <td className="value">
                <Measurements>
                  {measurementNames.map(name => {
                    return (
                      event && (
                        <TraceEventCustomPerformanceMetric
                          key={name}
                          event={event}
                          name={name}
                          location={location}
                          organization={organization}
                          source={undefined}
                          isHomepage={false}
                        />
                      )
                    );
                  })}
                </Measurements>
              </td>
            </tr>
          )}
        </tbody>
      </TraceDrawerComponents.Table>
      <LazyRender {...LAZY_RENDER_PROPS} containerHeight={200}>
        {organization.features.includes('event-tags-tree-ui') ? (
          <TagsWrapper>
            <NewTagsUI event={event} projectSlug={node.value.project_slug} />
          </TagsWrapper>
        ) : (
          <TraceDrawerComponents.Table className="table key-value">
            <tbody>
              <Tags
                enableHiding
                location={location}
                organization={organization}
                tags={event.tags}
                event={node.value}
              />
            </tbody>
          </TraceDrawerComponents.Table>
        )}
      </LazyRender>
      {project ? <EventEvidence event={event} project={project} /> : null}
      <LazyRender {...LAZY_RENDER_PROPS} containerHeight={480}>
        <ReplaySection event={event} organization={organization} />
      </LazyRender>
      {event.projectSlug ? (
        <Entries
          definedEvent={event}
          projectSlug={event.projectSlug}
          group={undefined}
          organization={organization}
          isShare
          hideBeforeReplayEntries
          hideBreadCrumbs
        />
      ) : null}
      {!objectIsEmpty(event.contexts?.feedback ?? {}) ? (
        <Chunk
          key="feedback"
          type="feedback"
          alias="feedback"
          group={undefined}
          event={event}
          value={event.contexts?.feedback ?? {}}
        />
      ) : null}
      {event.user && !objectIsEmpty(event.user) ? (
        <Chunk
          key="user"
          type="user"
          alias="user"
          group={undefined}
          event={event}
          value={event.user}
        />
      ) : null}
      <AdditionalMobileEventContexts event={event} />
      <EventExtraData event={event} />
      <EventSdk sdk={event.sdk} meta={event._meta?.sdk} />
      {event._metrics_summary ? (
        <CustomMetricsEventData
          projectId={event.projectID}
          metricsSummary={event._metrics_summary}
          startTimestamp={event.startTimestamp}
        />
      ) : null}
      <BreadCrumbsSection event={event} organization={organization} />
      {event.projectSlug ? (
        <EventAttachments event={event} projectSlug={event.projectSlug} />
      ) : null}
      {project ? <EventViewHierarchy event={event} project={project} /> : null}
      {event.projectSlug ? (
        <EventRRWebIntegration
          event={event}
          orgId={organization.slug}
          projectSlug={event.projectSlug}
        />
      ) : null}
    </TraceDrawerComponents.DetailContainer>
  );
}

const ReplaySectionContainer = styled('div')`
  display: flex;
  flex-direction: column;
`;

const ReplaySectionTitle = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: 600;
  margin-bottom: ${space(2)};
`;

const Measurements = styled('div')`
  display: flex;
  flex-wrap: wrap;
  gap: ${space(1)};
  padding-top: 10px;
`;

const TagsWrapper = styled('div')`
  h3 {
    color: ${p => p.theme.textColor};
  }
`;
