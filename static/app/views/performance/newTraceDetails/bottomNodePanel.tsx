import {
  createRef,
  type Dispatch,
  Fragment,
  type MutableRefObject,
  type SetStateAction,
  useEffect,
  useRef,
  useState,
} from 'react';
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
import NewTraceDetailsSpanDetail, {
  SpanDetailContainer,
  SpanDetails,
} from 'sentry/components/events/interfaces/spans/newTraceDetailsSpanDetails';
import {
  getFormattedTimeRangeWithLeadingAndTrailingZero,
  getSpanOperation,
  parseTrace,
} from 'sentry/components/events/interfaces/spans/utils';
import {generateStats} from 'sentry/components/events/opsBreakdown';
import {EventRRWebIntegration} from 'sentry/components/events/rrwebIntegration';
import {DataSection} from 'sentry/components/events/styles';
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
import {IconChevron, IconFire, IconGroup, IconOpen, IconSpan} from 'sentry/icons';
import {t, tct, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {
  type EntryBreadcrumbs,
  EntryType,
  type EventTransaction,
  type Organization,
} from 'sentry/types';
import {objectIsEmpty} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import type EventView from 'sentry/utils/discover/eventView';
import {getDuration} from 'sentry/utils/formatters';
import getDynamicText from 'sentry/utils/getDynamicText';
import type {
  TraceFullDetailed,
  TraceSplitResults,
} from 'sentry/utils/performance/quickTrace/types';
import {WEB_VITAL_DETAILS} from 'sentry/utils/performance/vitals/constants';
import {generateProfileFlamechartRoute} from 'sentry/utils/profiling/routes';
import {useApiQuery, type UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useProjects from 'sentry/utils/useProjects';
import {isCustomMeasurement} from 'sentry/views/dashboards/utils';
import {CustomMetricsEventData} from 'sentry/views/ddm/customMetricsEventData';
import {ProfileGroupProvider} from 'sentry/views/profiling/profileGroupProvider';
import {ProfileContext, ProfilesProvider} from 'sentry/views/profiling/profilesProvider';

import {TraceType} from '../traceDetails/newTraceDetailsContent';
import {Row, Tags} from '../traceDetails/styles';
import {getTraceInfo} from '../traceDetails/utils';
import {transactionSummaryRouteWithQuery} from '../transactionSummary/utils';

import {
  isMissingInstrumentationNode,
  isParentAutogroupedNode,
  isSiblingAutogroupedNode,
  isSpanNode,
  isTraceErrorNode,
  isTraceNode,
  isTransactionNode,
} from './guards';
import {TraceData} from './traceData';
import type {
  MissingInstrumentationNode,
  ParentAutogroupNode,
  SiblingAutogroupNode,
  TraceTree,
  TraceTreeNode,
} from './traceTree';

type EventDetailProps = {
  location: Location;
  node: TraceTreeNode<TraceTree.Transaction>;
  organization: Organization;
};

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
          <FlexBox style={{gap: '5px'}}>
            {t('Ops Breakdown')}
            <QuestionTooltip
              title={t('Applicable to the children of this event only')}
              size="xs"
            />
          </FlexBox>
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

function TransactionNodeDetails({node, organization, location}: EventDetailProps) {
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
      <StyledButton size="xs" to={target} onClick={handleOnClick}>
        {t('View Profile')}
      </StyledButton>
    );
  };

  return (
    <Wrapper>
      <TransactioNodeDetailHeader>
        <Title>
          <Tooltip title={node.value.project_slug}>
            <ProjectBadge
              project={project ? project : {slug: node.value.project_slug}}
              avatarSize={50}
              hideName
            />
          </Tooltip>
          <div>
            <div>{t('Event')}</div>
            <TransactionOp> {node.value['transaction.op']}</TransactionOp>
          </div>
        </Title>
        <Button
          size="sm"
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
      </TransactioNodeDetailHeader>

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

      <StyledTable className="table key-value">
        <tbody>
          <Row title={<TransactionIdTitle>{t('Event ID')}</TransactionIdTitle>}>
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
      </StyledTable>
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
    </Wrapper>
  );
}

function SpanNodeDetails({
  node,
  organization,
}: {
  node: TraceTreeNode<TraceTree.Span>;
  organization: Organization;
}) {
  const {projects} = useProjects();
  const {event, relatedErrors, childTxn, ...span} = node.value;
  const project = projects.find(proj => proj.slug === event?.projectSlug);
  const profileId = event?.contexts?.profile?.profile_id ?? null;

  return (
    <Wrapper>
      <Title>
        <Tooltip title={event.projectSlug}>
          <ProjectBadge
            project={project ? project : {slug: event.projectSlug || ''}}
            avatarSize={50}
            hideName
          />
        </Tooltip>
        <div>
          <div>{t('Span')}</div>
          <TransactionOp> {getSpanOperation(span)}</TransactionOp>
        </div>
      </Title>
      {event.projectSlug && (
        <ProfilesProvider
          orgSlug={organization.slug}
          projectSlug={event.projectSlug}
          profileId={profileId || ''}
        >
          <ProfileContext.Consumer>
            {profiles => (
              <ProfileGroupProvider
                type="flamechart"
                input={profiles?.type === 'resolved' ? profiles.data : null}
                traceID={profileId || ''}
              >
                <NewTraceDetailsSpanDetail
                  relatedErrors={relatedErrors}
                  childTransactions={childTxn ? [childTxn] : []}
                  event={event}
                  openPanel="open"
                  organization={organization}
                  span={span}
                  trace={parseTrace(event)}
                />
              </ProfileGroupProvider>
            )}
          </ProfileContext.Consumer>
        </ProfilesProvider>
      )}
    </Wrapper>
  );
}

function TraceNodeDetails({
  node,
  rootEventResults,
  traceType,
}: {
  node: TraceTreeNode<TraceTree.Trace>;
  rootEventResults: UseApiQueryResult<EventTransaction, RequestError>;
  traceType: TraceType | null;
}) {
  if (rootEventResults.isLoading) {
    return <LoadingIndicator />;
  }

  const {data: rootEvent} = rootEventResults;

  if (!rootEvent) {
    return null;
  }

  const traceInfo = getTraceInfo(node.value.transactions, node.value.orphan_errors);
  const opsBreakdown = generateStats(rootEvent, {type: 'no_filter'});
  const httpOp = opsBreakdown.find(obj => obj.name === 'http.client');
  const hasServiceBreakdown = httpOp && traceType === TraceType.ONE_ROOT;

  const totalDuration = rootEvent.endTimestamp - rootEvent.startTimestamp;
  const httpDuration = httpOp?.totalInterval ?? 0;
  const serverSidePct = ((httpDuration / totalDuration) * 100).toFixed();
  const clientSidePct = 100 - Number(serverSidePct);

  return (
    <Wrapper>
      <Title>
        <h2>{t('Trace')}</h2>
      </Title>

      <StyledTable className="table key-value">
        <tbody>
          <Row title={<TransactionIdTitle>{t('Duration')}</TransactionIdTitle>}>
            {getDuration(traceInfo.endTimestamp - traceInfo.startTimestamp, 2, true)}
          </Row>
          {hasServiceBreakdown && (
            <Fragment>
              <Row title={<TransactionIdTitle>{t('Client Side')}</TransactionIdTitle>}>
                <Dur>{getDuration(totalDuration - httpDuration, 2, true)}</Dur> (
                <Pct>{clientSidePct}%</Pct>)
              </Row>
              <Row title={<TransactionIdTitle>{t('Server Side')}</TransactionIdTitle>}>
                <Dur>{getDuration(httpDuration, 2, true)}</Dur> (
                <Pct>{serverSidePct}%</Pct>)
              </Row>
            </Fragment>
          )}
        </tbody>
      </StyledTable>
    </Wrapper>
  );
}

function ErrorNodeDetails({
  node,
  organization,
}: {
  node: TraceTreeNode<TraceTree.TraceError>;
  organization: Organization;
}) {
  return (
    <Wrapper>
      <IconTitleWrapper>
        <StyledErrorIconBorder>
          <IconFire color="errorText" size="lg" />
        </StyledErrorIconBorder>
        <h2>{t('Error')}</h2>
      </IconTitleWrapper>

      <StyledTable className="table key-value">
        <tbody>
          <Row
            title={<TransactionIdTitle>{t('Title')}</TransactionIdTitle>}
            extra={
              <StyledButton
                size="xs"
                to={generateIssueEventTarget(node.value, organization)}
              >
                {t('Go to Issue')}
              </StyledButton>
            }
          >
            {node.value.title}
          </Row>
        </tbody>
      </StyledTable>
    </Wrapper>
  );
}

function ParentAutogroupNodeDetails({node}: {node: ParentAutogroupNode}) {
  return (
    <Wrapper>
      <IconTitleWrapper>
        <StyledGroupIconBorder>
          <IconGroup color="blue300" size="lg" />
        </StyledGroupIconBorder>
        <h2>{t('Auto-Group')}</h2>
      </IconTitleWrapper>

      <StyledTable className="table key-value">
        <tbody>
          <Row title={<TransactionIdTitle>{t('Grouping Logic')}</TransactionIdTitle>}>
            {t(
              'Chain of immediate and only children spans with the same operation as their parent.'
            )}
          </Row>
          <Row title={<TransactionIdTitle>{t('Group Count')}</TransactionIdTitle>}>
            {node.groupCount}
          </Row>
          <Row title={<TransactionIdTitle>{t('Grouping Key')}</TransactionIdTitle>}>
            {t('Span Operation')} : {node.value.op}
          </Row>
        </tbody>
      </StyledTable>
    </Wrapper>
  );
}

function SiblingAutogroupNodeDetails({node}: {node: SiblingAutogroupNode}) {
  return (
    <Wrapper>
      <IconTitleWrapper>
        <StyledGroupIconBorder>
          <IconGroup color="blue300" size="lg" />
        </StyledGroupIconBorder>
        <h2>{t('Auto-Group')}</h2>
      </IconTitleWrapper>

      <StyledTable className="table key-value">
        <tbody>
          <Row title={<TransactionIdTitle>{t('Grouping Logic')}</TransactionIdTitle>}>
            {t('5 or more sibling spans with the same operation and description.')}
          </Row>
          <Row title={<TransactionIdTitle>{t('Group Count')}</TransactionIdTitle>}>
            {node.groupCount}
          </Row>
          <Row title={<TransactionIdTitle>{t('Grouping Key')}</TransactionIdTitle>}>
            {tct('Span operation: [operation] and description: [description]', {
              operation: node.value.op,
              description: node.value.description,
            })}
          </Row>
        </tbody>
      </StyledTable>
    </Wrapper>
  );
}

function MissingInstrumentationNodeDetails({node}: {node: MissingInstrumentationNode}) {
  return (
    <Wrapper>
      <IconTitleWrapper>
        <StyledGroupIconBorder>
          <IconSpan color="blue300" size="lg" />
        </StyledGroupIconBorder>
        <h2>{t('Missing Instrumentation Span')}</h2>
      </IconTitleWrapper>

      <StyledTable className="table key-value">
        <tbody>
          <Row title={<TransactionIdTitle>{t('Gap Duration')}</TransactionIdTitle>}>
            {getDuration(node.value.timestamp - node.value.start_timestamp, 2, true)}
          </Row>
          <Row title={<TransactionIdTitle>{t('Previous Span')}</TransactionIdTitle>}>
            {node.previous.value.op} - {node.previous.value.description}
          </Row>
          <Row title={<TransactionIdTitle>{t('Next Span')}</TransactionIdTitle>}>
            {node.next.value.op} - {node.next.value.description}
          </Row>
        </tbody>
      </StyledTable>
    </Wrapper>
  );
}

function NodeDetail({
  node,
  organization,
  location,
  rootEventResults,
  traceType,
}: {
  location: Location;
  node: TraceTreeNode<TraceTree.NodeValue> | null;
  organization: Organization;
  rootEventResults: UseApiQueryResult<EventTransaction, RequestError>;
  traceType: TraceType | null;
}) {
  if (!node) {
    return <NoDetail>{t('Click on a row in the trace view for its details')}</NoDetail>;
  }

  return isTransactionNode(node) ? (
    <TransactionNodeDetails node={node} organization={organization} location={location} />
  ) : isSpanNode(node) ? (
    <SpanNodeDetails node={node} organization={organization} />
  ) : isTraceNode(node) ? (
    <TraceNodeDetails
      rootEventResults={rootEventResults}
      traceType={traceType}
      node={node}
    />
  ) : isTraceErrorNode(node) ? (
    <ErrorNodeDetails node={node} organization={organization} />
  ) : isParentAutogroupedNode(node) ? (
    <ParentAutogroupNodeDetails node={node} />
  ) : isSiblingAutogroupedNode(node) ? (
    <SiblingAutogroupNodeDetails node={node} />
  ) : isMissingInstrumentationNode(node) ? (
    <MissingInstrumentationNodeDetails node={node} />
  ) : null;
}

type PanelProps = {
  location: Location;
  node: TraceTreeNode<TraceTree.NodeValue> | null;
  organization: Organization;
  rootEventResults: UseApiQueryResult<EventTransaction, RequestError>;
  setDetailPanelRef: Dispatch<
    SetStateAction<MutableRefObject<HTMLDivElement | null> | null>
  >;
  traceEventView: EventView;
  traceType: TraceType | null;
  traces: TraceSplitResults<TraceFullDetailed> | null;
};

const MIN_PANEL_HEIGHT = 100;
const INITIAL_PANEL_HEIGHT = 200;

function BottomNodePanel(props: PanelProps) {
  const [activeTab, setActiveTab] = useState<'trace_data' | 'node_detail'>(
    props.node ? 'node_detail' : 'trace_data'
  );

  const [size, setSize] = useState(INITIAL_PANEL_HEIGHT);

  const [isResizing, setIsResizing] = useState(false);

  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleMouseMove = e => {
      if (!isResizing) return;
      const newSize = Math.max(MIN_PANEL_HEIGHT, size + e.movementY * -1);
      setSize(newSize);
    };

    const handleMouseUp = () => setIsResizing(false);

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [size, isResizing]);

  useEffect(() => {
    if (props.node) {
      setActiveTab('node_detail');
    }
  }, [props.node]);

  useEffect(() => {
    props.setDetailPanelRef(panelRef);
  }, [panelRef, props]);

  const handleMouseDown = e => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);
  };

  return (
    <PanelWrapper size={size} ref={panelRef}>
      <TabsContainer onMouseDown={handleMouseDown}>
        <Tab
          active={activeTab === 'node_detail'}
          onClick={() => setActiveTab('node_detail')}
        >
          {t('Details')}
        </Tab>
        <Tab
          active={activeTab === 'trace_data'}
          onClick={() => setActiveTab('trace_data')}
        >
          {t('Trace Data')}
        </Tab>
      </TabsContainer>

      <Content>
        {activeTab === 'trace_data' && (
          <TraceData
            rootEventResults={props.rootEventResults}
            organization={props.organization}
            location={props.location}
            traces={props.traces}
            traceEventView={props.traceEventView}
          />
        )}
        {activeTab === 'node_detail' && (
          <NodeDetail
            traceType={props.traceType}
            rootEventResults={props.rootEventResults}
            node={props.node}
            organization={props.organization}
            location={props.location}
          />
        )}
      </Content>
    </PanelWrapper>
  );
}

const NoDetail = styled('div')`
  display: flex;
  justify-content: center;
  align-items: center;
  border-radius: ${space(1)};
  border: 2px dashed ${p => p.theme.border};
  height: 100%;
`;

const PanelWrapper = styled('div')<{size: number}>`
  display: flex;
  flex-direction: column;
  width: 100%;
  height: ${p => p.size}px;
  position: sticky;
  border: 1px solid ${p => p.theme.border};
  bottom: 0;
  right: 0;
  background: ${p => p.theme.background};
  color: ${p => p.theme.textColor};
  text-align: left;
  z-index: ${p => p.theme.zIndex.sidebar - 1};
`;

const TabsContainer = styled('div')`
  width: 100%;
  min-height: 30px;
  border-bottom: 1px solid ${p => p.theme.border};
  background-color: ${p => p.theme.backgroundSecondary};
  display: flex;
  align-items: center;
  justify-content: left;
  padding-left: ${space(2)};
  gap: ${space(2)};
  cursor: row-resize;
`;

const Tab = styled('div')<{active: boolean}>`
  cursor: pointer;
  font-size: ${p => p.theme.fontSizeSmall};
  ${p => p.active && `font-weight: bold; border-bottom: 2px solid ${p.theme.textColor};`}
`;

const Content = styled('div')`
  overflow: scroll;
  padding: ${space(2)};
  flex: 1;
`;

const StyledButton = styled(Button)`
  position: absolute;
  top: ${space(0.75)};
  right: ${space(0.5)};
`;

const Wrapper = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
  padding: ${space(1)};

  ${DataSection} {
    padding: 0;
  }

  ${SpanDetails} {
    padding: 0;
  }

  ${SpanDetailContainer} {
    border-bottom: none !important;
  }
`;

const FlexBox = styled('div')`
  display: flex;
  align-items: center;
`;

const Title = styled(FlexBox)`
  gap: ${space(2)};
`;

const TransactioNodeDetailHeader = styled(Title)`
  justify-content: space-between;
`;

const IconTitleWrapper = styled(FlexBox)`
  gap: ${space(1)};
`;

const TransactionOp = styled('div')`
  font-size: 25px;
  font-weight: bold;
  max-width: 600px;
  ${p => p.theme.overflowEllipsis}
`;

const TransactionIdTitle = styled('a')`
  display: flex;
  color: ${p => p.theme.textColor};
  :hover {
    color: ${p => p.theme.textColor};
  }
`;

const Measurements = styled('div')`
  display: flex;
  flex-wrap: wrap;
  gap: ${space(1)};
  padding-top: 10px;
`;

const StyledTable = styled('table')`
  margin-bottom: 0 !important;
`;

const Dur = styled('span')`
  color: ${p => p.theme.gray300};
  font-variant-numeric: tabular-nums;
`;

const Pct = styled('span')`
  min-width: 40px;
  text-align: right;
  font-variant-numeric: tabular-nums;
`;

const StyledErrorIconBorder = styled('div')`
  border: 1px solid ${p => p.theme.error};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(1)} ${space(1)} 3px ${space(1)};
  margin-bottom: ${space(2)};
`;

const StyledGroupIconBorder = styled('div')`
  border: 1px solid ${p => p.theme.blue300};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(1)} ${space(1)} 3px ${space(1)};
  margin-bottom: ${space(2)};
`;

export default BottomNodePanel;
