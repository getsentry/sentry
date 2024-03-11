import {createRef, Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';
import omit from 'lodash/omit';

import Alert from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import DateTime from 'sentry/components/dateTime';
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
import {EventSdk} from 'sentry/components/events/eventSdk';
import {EventViewHierarchy} from 'sentry/components/events/eventViewHierarchy';
import {Breadcrumbs} from 'sentry/components/events/interfaces/breadcrumbs';
import {getFormattedTimeRangeWithLeadingAndTrailingZero} from 'sentry/components/events/interfaces/spans/utils';
import {generateStats} from 'sentry/components/events/opsBreakdown';
import {EventRRWebIntegration} from 'sentry/components/events/rrwebIntegration';
import FileSize from 'sentry/components/fileSize';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import Link from 'sentry/components/links/link';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {
  ErrorDot,
  ErrorLevel,
  ErrorMessageContent,
  ErrorMessageTitle,
  ErrorTitle,
} from 'sentry/components/performance/waterfall/rowDetails';
import PerformanceDuration from 'sentry/components/performanceDuration';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {generateIssueEventTarget} from 'sentry/components/quickTrace/utils';
import {Tooltip} from 'sentry/components/tooltip';
import {PAGE_URL_PARAM} from 'sentry/constants/pageFilters';
import {IconChevron, IconOpen} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {
  type EntryBreadcrumbs,
  EntryType,
  type EventTransaction,
  type Organization,
} from 'sentry/types';
import {objectIsEmpty} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import getDynamicText from 'sentry/utils/getDynamicText';
import {WEB_VITAL_DETAILS} from 'sentry/utils/performance/vitals/constants';
import {generateProfileFlamechartRoute} from 'sentry/utils/profiling/routes';
import {useApiQuery} from 'sentry/utils/queryClient';
import useProjects from 'sentry/utils/useProjects';
import {isCustomMeasurement} from 'sentry/views/dashboards/utils';
import {CustomMetricsEventData} from 'sentry/views/ddm/customMetricsEventData';
import type {VirtualizedViewManager} from 'sentry/views/performance/newTraceDetails/virtualizedViewManager';
import {Row, Tags} from 'sentry/views/performance/traceDetails/styles';
import {transactionSummaryRouteWithQuery} from 'sentry/views/performance/transactionSummary/utils';

import type {TraceTree, TraceTreeNode} from '../../traceTree';

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

  useEffect(() => {
    setTimeout(() => {
      if (showBreadCrumbs) {
        breadCrumbsContainerRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'end',
        });
      }
    }, 100);
  }, [showBreadCrumbs, breadCrumbsContainerRef]);

  const matchingEntry: EntryBreadcrumbs | undefined = event?.entries.find(
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

type TransactionDetailProps = {
  location: Location;
  manager: VirtualizedViewManager;
  node: TraceTreeNode<TraceTree.Transaction>;
  organization: Organization;
  scrollToNode: (node: TraceTreeNode<TraceTree.NodeValue>) => void;
};

export function TransactionNodeDetails({
  node,
  organization,
  location,
  scrollToNode,
}: TransactionDetailProps) {
  const {projects} = useProjects();
  const {data: event} = useApiQuery<EventTransaction>(
    [
      `/organizations/${organization.slug}/events/${node.value.project_slug}:${node.value.event_id}/`,
      {
        query: {
          referrer: 'trace-details-summary',
        },
      },
    ],
    {
      staleTime: 0,
      enabled: !!node,
    }
  );

  if (!event) {
    return <LoadingIndicator />;
  }

  const {user, contexts, projectSlug} = event;
  const {feedback} = contexts ?? {};
  const eventJsonUrl = `/api/0/projects/${organization.slug}/${node.value.project_slug}/events/${node.value.event_id}/json/`;
  const project = projects.find(proj => proj.slug === event?.projectSlug);
  const {errors, performance_issues} = node.value;
  const hasIssues = errors.length + performance_issues.length > 0;
  const startTimestamp = Math.min(node.value.start_timestamp, node.value.timestamp);
  const endTimestamp = Math.max(node.value.start_timestamp, node.value.timestamp);
  const {start: startTimeWithLeadingZero, end: endTimeWithLeadingZero} =
    getFormattedTimeRangeWithLeadingAndTrailingZero(startTimestamp, endTimestamp);
  const duration = (endTimestamp - startTimestamp) * 1000;
  const durationString = `${Number(duration.toFixed(3)).toLocaleString()}ms`;
  const measurementNames = Object.keys(node.value.measurements ?? {})
    .filter(name => isCustomMeasurement(`measurements.${name}`))
    .filter(isNotMarkMeasurement)
    .filter(isNotPerformanceScoreMeasurement)
    .sort();

  const renderMeasurements = () => {
    if (!event) {
      return null;
    }

    const {measurements} = event;

    const measurementKeys = Object.keys(measurements ?? {})
      .filter(name => Boolean(WEB_VITAL_DETAILS[`measurements.${name}`]))
      .sort();

    if (!measurements || measurementKeys.length <= 0) {
      return null;
    }

    return (
      <Fragment>
        {measurementKeys.map(measurement => (
          <Row
            key={measurement}
            title={WEB_VITAL_DETAILS[`measurements.${measurement}`]?.name}
          >
            <PerformanceDuration
              milliseconds={Number(measurements[measurement].value.toFixed(3))}
              abbreviation
            />
          </Row>
        ))}
      </Fragment>
    );
  };

  const renderGoToProfileButton = () => {
    if (!node.value.profile_id) {
      return null;
    }

    const target = generateProfileFlamechartRoute({
      orgSlug: organization.slug,
      projectSlug: node.value.project_slug,
      profileId: node.value.profile_id,
    });

    function handleOnClick() {
      trackAnalytics('profiling_views.go_to_flamegraph', {
        organization,
        source: 'performance.trace_view',
      });
    }

    return (
      <TraceDrawerComponents.Button size="xs" to={target} onClick={handleOnClick}>
        {t('View Profile')}
      </TraceDrawerComponents.Button>
    );
  };

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
          <div>
            <div>{t('transaction')}</div>
            <TraceDrawerComponents.TitleOp>
              {' '}
              {node.value['transaction.op']}
            </TraceDrawerComponents.TitleOp>
          </div>
        </TraceDrawerComponents.Title>
        <TraceDrawerComponents.Actions>
          <Button size="xs" onClick={_e => scrollToNode(node)}>
            {t('Scroll in view')}
          </Button>
          <Button
            size="xs"
            icon={<IconOpen />}
            href={eventJsonUrl}
            external
            onClick={() =>
              trackAnalytics('performance_views.event_details.json_button_click', {
                organization,
              })
            }
          >
            {t('JSON')} (<FileSize bytes={event?.size} />)
          </Button>
        </TraceDrawerComponents.Actions>
      </TraceDrawerComponents.HeaderContainer>

      {hasIssues && (
        <Alert
          system
          defaultExpanded
          type="error"
          expand={[...node.value.errors, ...node.value.performance_issues].map(error => (
            <ErrorMessageContent key={error.event_id}>
              <ErrorDot level={error.level} />
              <ErrorLevel>{error.level}</ErrorLevel>
              <ErrorTitle>
                <Link to={generateIssueEventTarget(error, organization)}>
                  {error.title}
                </Link>
              </ErrorTitle>
            </ErrorMessageContent>
          ))}
        >
          <ErrorMessageTitle>
            {tn(
              '%s issue occurred in this transaction.',
              '%s issues occurred in this transaction.',
              node.value.errors.length + node.value.performance_issues.length
            )}
          </ErrorMessageTitle>
        </Alert>
      )}

      <TraceDrawerComponents.Table className="table key-value">
        <tbody>
          <Row title={t('Event ID')}>
            {node.value.event_id}
            <CopyToClipboardButton
              borderless
              size="zero"
              iconSize="xs"
              text={`${window.location.href.replace(window.location.hash, '')}#txn-${
                node.value.event_id
              }`}
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
          {node.value.profile_id && (
            <Row title="Profile ID" extra={renderGoToProfileButton()}>
              {node.value.profile_id}
            </Row>
          )}
          <Row title="Duration">{durationString}</Row>
          <Row title="Date Range">
            {getDynamicText({
              fixed: 'Mar 19, 2021 11:06:27 AM UTC',
              value: (
                <Fragment>
                  <DateTime date={startTimestamp * 1000} />
                  {` (${startTimeWithLeadingZero})`}
                </Fragment>
              ),
            })}
            <br />
            {getDynamicText({
              fixed: 'Mar 19, 2021 11:06:28 AM UTC',
              value: (
                <Fragment>
                  <DateTime date={endTimestamp * 1000} />
                  {` (${endTimeWithLeadingZero})`}
                </Fragment>
              ),
            })}
          </Row>

          <OpsBreakdown event={event} />

          {renderMeasurements()}

          <Tags
            enableHiding
            location={location}
            organization={organization}
            transaction={node.value}
          />

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
      {project && <EventEvidence event={event} project={project} />}
      {projectSlug && (
        <Entries
          definedEvent={event}
          projectSlug={projectSlug}
          group={undefined}
          organization={organization}
          isShare={false}
          hideBeforeReplayEntries
          hideBreadCrumbs
        />
      )}
      {!objectIsEmpty(feedback) && (
        <Chunk
          key="feedback"
          type="feedback"
          alias="feedback"
          group={undefined}
          event={event}
          value={feedback}
        />
      )}
      {user && !objectIsEmpty(user) && (
        <Chunk
          key="user"
          type="user"
          alias="user"
          group={undefined}
          event={event}
          value={user}
        />
      )}
      <EventExtraData event={event} />
      <EventSdk sdk={event.sdk} meta={event._meta?.sdk} />
      {event._metrics_summary ? (
        <CustomMetricsEventData
          metricsSummary={event._metrics_summary}
          startTimestamp={event.startTimestamp}
        />
      ) : null}
      <BreadCrumbsSection event={event} organization={organization} />
      {projectSlug && <EventAttachments event={event} projectSlug={projectSlug} />}
      {project && <EventViewHierarchy event={event} project={project} />}
      {projectSlug && (
        <EventRRWebIntegration
          event={event}
          orgId={organization.slug}
          projectSlug={projectSlug}
        />
      )}
    </TraceDrawerComponents.DetailContainer>
  );
}

const Measurements = styled('div')`
  display: flex;
  flex-wrap: wrap;
  gap: ${space(1)};
  padding-top: 10px;
`;
