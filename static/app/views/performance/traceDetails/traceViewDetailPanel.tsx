import {Fragment, useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';
import omit from 'lodash/omit';

import {Alert} from 'sentry/components/alert';
import {LinkButton} from 'sentry/components/button';
import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import {DateTime} from 'sentry/components/dateTime';
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
import type {SpanDetailProps} from 'sentry/components/events/interfaces/spans/newTraceDetailsSpanDetails';
import NewTraceDetailsSpanDetail, {
  SpanDetailContainer,
  SpanDetails,
} from 'sentry/components/events/interfaces/spans/newTraceDetailsSpanDetails';
import {
  getFormattedTimeRangeWithLeadingAndTrailingZero,
  getSpanOperation,
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
import {IconChevron, IconOpen} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {EntryBreadcrumbs, EventTransaction} from 'sentry/types/event';
import {EntryType} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import getDynamicText from 'sentry/utils/getDynamicText';
import {PageAlertProvider} from 'sentry/utils/performance/contexts/pageAlert';
import {WEB_VITAL_DETAILS} from 'sentry/utils/performance/vitals/constants';
import {generateProfileFlamechartRoute} from 'sentry/utils/profiling/routes';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {isCustomMeasurement} from 'sentry/views/dashboards/utils';
import DetailPanel from 'sentry/views/insights/common/components/detailPanel';
import {ProfileGroupProvider} from 'sentry/views/profiling/profileGroupProvider';
import {ProfileContext, ProfilesProvider} from 'sentry/views/profiling/profilesProvider';

import {transactionSummaryRouteWithQuery} from '../transactionSummary/utils';

import type {EventDetail} from './newTraceDetailsContent';
import {Row, Tags} from './styles';

type DetailPanelProps = {
  detail: EventDetail | SpanDetailProps | undefined;
  onClose: () => void;
};

type EventDetailProps = {
  detail: EventDetail;
  location: Location;
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
  const breadCrumbsContainerRef = useRef<HTMLDivElement>(null);

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
function EventDetails({detail, organization, location}: EventDetailProps) {
  const {projects} = useProjects();

  if (!detail.event) {
    return <LoadingIndicator />;
  }

  const {projectSlug} = detail.event;

  const eventJsonUrl = `/api/0/projects/${organization.slug}/${detail.traceFullDetailedEvent.project_slug}/events/${detail.traceFullDetailedEvent.event_id}/json/`;
  const project = projects.find(proj => proj.slug === detail.event?.projectSlug);
  const {errors, performance_issues} = detail.traceFullDetailedEvent;
  const hasIssues = errors.length + performance_issues.length > 0;
  const startTimestamp = Math.min(
    detail.traceFullDetailedEvent.start_timestamp,
    detail.traceFullDetailedEvent.timestamp
  );
  const endTimestamp = Math.max(
    detail.traceFullDetailedEvent.start_timestamp,
    detail.traceFullDetailedEvent.timestamp
  );
  const {start: startTimeWithLeadingZero, end: endTimeWithLeadingZero} =
    getFormattedTimeRangeWithLeadingAndTrailingZero(startTimestamp, endTimestamp);
  const duration = (endTimestamp - startTimestamp) * 1000;
  const durationString = `${Number(duration.toFixed(3)).toLocaleString()}ms`;
  const measurementNames = Object.keys(detail.traceFullDetailedEvent.measurements ?? {})
    .filter(name => isCustomMeasurement(`measurements.${name}`))
    .filter(isNotMarkMeasurement)
    .filter(isNotPerformanceScoreMeasurement)
    .sort();

  const renderMeasurements = () => {
    if (!detail.event) {
      return null;
    }

    const {measurements} = detail.event;

    const measurementKeys = Object.keys(measurements ?? {})
      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
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
            // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
            title={WEB_VITAL_DETAILS[`measurements.${measurement}`]?.name}
          >
            <PerformanceDuration
              milliseconds={Number(measurements[measurement]!.value.toFixed(3))}
              abbreviation
            />
          </Row>
        ))}
      </Fragment>
    );
  };

  const renderGoToProfileButton = () => {
    if (!detail.traceFullDetailedEvent.profile_id) {
      return null;
    }

    const target = generateProfileFlamechartRoute({
      orgSlug: organization.slug,
      projectSlug: detail.traceFullDetailedEvent.project_slug,
      profileId: detail.traceFullDetailedEvent.profile_id,
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
      <Actions>
        <LinkButton
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
          {t('JSON')} (<FileSize bytes={detail.event?.size} />)
        </LinkButton>
      </Actions>

      <Title>
        <Tooltip title={detail.traceFullDetailedEvent.project_slug}>
          <ProjectBadge
            project={
              project ? project : {slug: detail.traceFullDetailedEvent.project_slug}
            }
            avatarSize={50}
            hideName
          />
        </Tooltip>
        <div>
          <div>{t('Event')}</div>
          <TransactionOp>
            {' '}
            {detail.traceFullDetailedEvent['transaction.op']}
          </TransactionOp>
        </div>
      </Title>

      {hasIssues && (
        <Alert
          system
          defaultExpanded
          type="error"
          expand={[
            ...detail.traceFullDetailedEvent.errors,
            ...detail.traceFullDetailedEvent.performance_issues,
          ].map(error => (
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
              detail.traceFullDetailedEvent.errors.length +
                detail.traceFullDetailedEvent.performance_issues.length
            )}
          </ErrorMessageTitle>
        </Alert>
      )}

      <StyledTable className="table key-value">
        <tbody>
          <Row title={<TransactionIdTitle>{t('Event ID')}</TransactionIdTitle>}>
            {detail.traceFullDetailedEvent.event_id}
            <CopyToClipboardButton
              borderless
              size="zero"
              iconSize="xs"
              text={`${window.location.href.replace(window.location.hash, '')}#txn-${
                detail.traceFullDetailedEvent.event_id
              }`}
            />
          </Row>
          <Row title={t('Description')}>
            <Link
              to={transactionSummaryRouteWithQuery({
                organization,
                transaction: detail.traceFullDetailedEvent.transaction,
                query: omit(location.query, Object.values(PAGE_URL_PARAM)),
                projectID: String(detail.traceFullDetailedEvent.project_id),
              })}
            >
              {detail.traceFullDetailedEvent.transaction}
            </Link>
          </Row>
          {detail.traceFullDetailedEvent.profile_id && (
            <Row title="Profile ID" extra={renderGoToProfileButton()}>
              {detail.traceFullDetailedEvent.profile_id}
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

          <OpsBreakdown event={detail.event} />

          {renderMeasurements()}

          <Tags
            enableHiding
            location={location}
            organization={organization}
            tags={detail.traceFullDetailedEvent.tags ?? []}
            event={detail.traceFullDetailedEvent}
          />

          {measurementNames.length > 0 && (
            <tr>
              <td className="key">{t('Measurements')}</td>
              <td className="value">
                <Measurements>
                  {measurementNames.map(name => {
                    return (
                      detail.event && (
                        <TraceEventCustomPerformanceMetric
                          key={name}
                          event={detail.event}
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
      {project && <EventEvidence event={detail.event} project={project} />}
      {projectSlug && (
        <Entries
          definedEvent={detail.event}
          projectSlug={projectSlug}
          group={undefined}
          organization={organization}
          isShare={false}
          hideBeforeReplayEntries
          hideBreadCrumbs
        />
      )}
      <EventExtraData event={detail.event} />
      <EventSdk sdk={detail.event.sdk} meta={detail.event._meta?.sdk} />
      <BreadCrumbsSection event={detail.event} organization={organization} />
      {project && (
        <EventAttachments event={detail.event} project={project} group={undefined} />
      )}
      {project && <EventViewHierarchy event={detail.event} project={project} />}
      {projectSlug && (
        <EventRRWebIntegration
          event={detail.event}
          orgId={organization.slug}
          projectSlug={projectSlug}
        />
      )}
    </Wrapper>
  );
}

function SpanDetailsBody({
  detail,
  organization,
}: {
  detail: SpanDetailProps;
  organization: Organization;
}) {
  const {projects} = useProjects();
  const project = projects.find(proj => proj.slug === detail.event?.projectSlug);
  const profileId = detail?.event?.contexts?.profile?.profile_id ?? null;

  return (
    <Wrapper>
      <Title>
        <Tooltip title={detail.event.projectSlug}>
          <ProjectBadge
            project={project ? project : {slug: detail.event.projectSlug || ''}}
            avatarSize={50}
            hideName
          />
        </Tooltip>
        <div>
          <div>{t('Span')}</div>
          <TransactionOp> {getSpanOperation(detail.node.value)}</TransactionOp>
        </div>
      </Title>
      {detail.event.projectSlug && (
        <ProfilesProvider
          orgSlug={organization.slug}
          projectSlug={detail.event.projectSlug}
          profileMeta={profileId || ''}
        >
          <ProfileContext.Consumer>
            {profiles => (
              <ProfileGroupProvider
                type="flamechart"
                input={profiles?.type === 'resolved' ? profiles.data : null}
                traceID={profileId || ''}
              >
                <NewTraceDetailsSpanDetail {...detail} />
              </ProfileGroupProvider>
            )}
          </ProfileContext.Consumer>
        </ProfilesProvider>
      )}
    </Wrapper>
  );
}

export function isEventDetail(
  detail: EventDetail | SpanDetailProps
): detail is EventDetail {
  return !('span' in detail);
}

function TraceViewDetailPanel({detail, onClose}: DetailPanelProps) {
  const organization = useOrganization();
  const location = useLocation();
  return (
    <PageAlertProvider>
      <DetailPanel
        detailKey={detail && detail.openPanel === 'open' ? 'open' : undefined}
        onClose={onClose}
      >
        {detail &&
          (isEventDetail(detail) ? (
            <EventDetails
              location={location}
              organization={organization}
              detail={detail}
            />
          ) : (
            <SpanDetailsBody organization={organization} detail={detail} />
          ))}
      </DetailPanel>
    </PageAlertProvider>
  );
}

const Wrapper = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};

  ${DataSection} {
    padding: 0;
  }

  ${SpanDetails} {
    padding: 0;
  }

  ${SpanDetailContainer} {
    border-bottom: none;
  }
`;

const FlexBox = styled('div')`
  display: flex;
  align-items: center;
`;
const Actions = styled('div')`
  display: flex;
  align-items: center;
  justify-content: flex-end;
`;

const Title = styled(FlexBox)`
  gap: ${space(2)};
`;

const TransactionOp = styled('div')`
  font-size: 25px;
  font-weight: ${p => p.theme.fontWeightBold};
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

const StyledButton = styled(LinkButton)`
  position: absolute;
  top: ${space(0.75)};
  right: ${space(0.5)};
`;

const StyledTable = styled('table')`
  margin-bottom: 0 !important;
`;

export default TraceViewDetailPanel;
