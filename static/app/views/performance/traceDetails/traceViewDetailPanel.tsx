import {createRef, Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';
import omit from 'lodash/omit';

import Alert from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import DateTime from 'sentry/components/dateTime';
import {
  isNotMarkMeasurement,
  isNotPerformanceScoreMeasurement,
  TraceEventCustomPerformanceMetric,
} from 'sentry/components/events/eventCustomPerformanceMetrics';
import {Breadcrumbs} from 'sentry/components/events/interfaces/breadcrumbs';
import {getFormattedTimeRangeWithLeadingAndTrailingZero} from 'sentry/components/events/interfaces/spans/utils';
import {generateStats} from 'sentry/components/events/opsBreakdown';
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
import QuestionTooltip from 'sentry/components/questionTooltip';
import {generateIssueEventTarget} from 'sentry/components/quickTrace/utils';
import {Tooltip} from 'sentry/components/tooltip';
import {PAGE_URL_PARAM} from 'sentry/constants/pageFilters';
import {IconChevron, IconOpen} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {EntryBreadcrumbs, EntryType, EventTransaction, Organization} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import getDynamicText from 'sentry/utils/getDynamicText';
import {PageErrorProvider} from 'sentry/utils/performance/contexts/pageError';
import {generateProfileFlamechartRoute} from 'sentry/utils/profiling/routes';
import Projects from 'sentry/utils/projects';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {isCustomMeasurement} from 'sentry/views/dashboards/utils';
import DetailPanel from 'sentry/views/starfish/components/detailPanel';

import {transactionSummaryRouteWithQuery} from '../transactionSummary/utils';

import {EventDetail} from './newTraceDetailsContent';
import {Row, Tags} from './styles';

type DetailPanelProps = {
  detail: EventDetail | undefined;
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
            Ops Breakdown
            <QuestionTooltip
              title={t('Applicable to the children of this event only')}
              size="xs"
            />
          </FlexBox>
        }
      >
        <div style={{display: 'flex', flexDirection: 'column', gap: space(0.25)}}>
          {breakdown.slice(0, showingAll ? breakdown.length : 5).map((currOp, index) => {
            const {name, percentage, totalInterval} = currOp;

            const operationName = typeof name === 'string' ? name : t('Other');
            const durLabel = Math.round(totalInterval * 1000 * 100) / 100;
            const pctLabel = isFinite(percentage) ? Math.round(percentage * 100) : '∞';

            return (
              <div key={index}>
                {operationName}: {durLabel}ms ({pctLabel}%)
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
      breadCrumbsContainerRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'end',
      });
    }, 100);
  }, [showBreadCrumbs, breadCrumbsContainerRef]);

  const matchingEntry: EntryBreadcrumbs | undefined = event?.entries.find(
    entry => entry.type === EntryType.BREADCRUMBS
  ) as EntryBreadcrumbs;

  if (!matchingEntry) {
    return null;
  }

  const renderText = showBreadCrumbs ? t('Hide Breadcrumbs') : t('Show Breadcrumbs');
  const chevron = showBreadCrumbs ? (
    <IconChevron size="xs" direction="up" />
  ) : (
    <IconChevron size="xs" direction="down" />
  );
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
  const eventJsonUrl = `/api/0/projects/${organization.slug}/${detail.traceFullDetailedEvent.project_slug}/events/${detail.traceFullDetailedEvent.event_id}/json/`;
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

  return detail.event ? (
    <Wrapper>
      <Actions>
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
          {t('JSON')} (<FileSize bytes={detail.event?.size} />)
        </Button>
      </Actions>

      <Title>
        <Projects
          orgId={organization.slug}
          slugs={[detail.traceFullDetailedEvent.project_slug]}
        >
          {({projects}) => {
            const project = projects.find(
              p => p.slug === detail.traceFullDetailedEvent.project_slug
            );
            return (
              <Tooltip title={detail.traceFullDetailedEvent.project_slug}>
                <ProjectBadge
                  project={
                    project ? project : {slug: detail.traceFullDetailedEvent.project_slug}
                  }
                  avatarSize={50}
                  hideName
                />
              </Tooltip>
            );
          }}
        </Projects>
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
                orgSlug: organization.slug,
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

          <Tags
            enableHiding
            location={location}
            organization={organization}
            transaction={detail.traceFullDetailedEvent}
          />

          {measurementNames.length > 0 && (
            <tr>
              <td className="key">Custom Metrics</td>
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
      <BreadCrumbsSection event={detail.event} organization={organization} />
    </Wrapper>
  ) : (
    <LoadingIndicator />
  );
}

function TraceViewDetailPanel({detail, onClose}: DetailPanelProps) {
  const organization = useOrganization();
  const location = useLocation();
  return (
    <PageErrorProvider>
      <DetailPanel detailKey={detail ? 'open' : undefined} onClose={onClose}>
        {detail && (
          <EventDetails location={location} organization={organization} detail={detail} />
        )}
      </DetailPanel>
    </PageErrorProvider>
  );
}

const Wrapper = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
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
  font-weight: bold;
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

const StyledButton = styled(Button)`
  position: absolute;
  top: ${space(0.75)};
  right: ${space(0.5)};
`;

const StyledTable = styled('table')`
  margin-bottom: 0;
`;

export default TraceViewDetailPanel;
