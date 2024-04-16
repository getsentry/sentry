import styled from '@emotion/styled';

import Duration from 'sentry/components/duration';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import Link from 'sentry/components/links/link';
import {RowRectangle} from 'sentry/components/performance/waterfall/rowBar';
import {pickBarColor} from 'sentry/components/performance/waterfall/utils';
import {Tooltip} from 'sentry/components/tooltip';
import type {DateString} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {
  generateEventSlug,
  generateLinkToEventInTraceView,
} from 'sentry/utils/discover/urls';
import {getShortEventId} from 'sentry/utils/events';
import toPercent from 'sentry/utils/number/toPercent';
import Projects from 'sentry/utils/projects';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {getTraceDetailsUrl} from 'sentry/views/performance/traceDetails/utils';
import {transactionSummaryRouteWithQuery} from 'sentry/views/performance/transactionSummary/utils';

interface ProjectRendererProps {
  projectSlug: string;
  hideName?: boolean;
}

export function ProjectRenderer({projectSlug, hideName}: ProjectRendererProps) {
  const organization = useOrganization();

  return (
    <Projects orgId={organization.slug} slugs={[projectSlug]}>
      {({projects}) => {
        const project = projects.find(p => p.slug === projectSlug);
        return (
          <ProjectBadge
            hideName={hideName}
            project={project ? project : {slug: projectSlug}}
            avatarSize={16}
          />
        );
      }}
    </Projects>
  );
}

const RelativeOpsBreakdown = styled('div')`
  position: relative;
  display: flex;
  min-width: 150px;
`;

const RectangleRelativeOpsBreakdown = styled(RowRectangle)`
  position: relative;
  width: 100%;
`;

export function TraceBreakdownRenderer({trace}: {trace: TraceResult<Field>}) {
  const widthPercentage = 1.0;
  const operationName = 'trace';
  const spanOpDuration = 1000;
  return (
    <RelativeOpsBreakdown data-test-id="relative-ops-breakdown">
      <div key={operationName} style={{width: toPercent(widthPercentage || 0)}}>
        <Tooltip
          title={
            <div>
              <div>{operationName}</div>
              <div>
                <Duration seconds={spanOpDuration / 1000} fixedDigits={2} abbreviation />
              </div>
            </div>
          }
          containerDisplayMode="block"
        >
          <RectangleRelativeOpsBreakdown
            style={{
              backgroundColor: pickBarColor(operationName),
            }}
            onClick={_ => {}}
          />
        </Tooltip>
      </div>
    </RelativeOpsBreakdown>
  );
}

interface SpanIdRendererProps {
  projectSlug: string;
  spanId: string;
  timestamp: string;
  traceId: string;
  transactionId: string;
}

export function SpanIdRenderer({
  projectSlug,
  spanId,
  timestamp,
  traceId,
  transactionId,
}: SpanIdRendererProps) {
  const location = useLocation();
  const organization = useOrganization();

  const target = generateLinkToEventInTraceView({
    eventSlug: generateEventSlug({
      id: transactionId,
      project: projectSlug,
    }),
    organization,
    location,
    eventView: EventView.fromLocation(location),
    dataRow: {
      id: transactionId,
      trace: traceId,
      timestamp,
    },
    spanId,
  });

  return <Link to={target}>{getShortEventId(spanId)}</Link>;
}

interface TraceIdRendererProps {
  traceId: string;
  timestamp?: DateString;
  transactionId?: string;
}

export function TraceIdRenderer({
  traceId,
  timestamp,
  transactionId,
}: TraceIdRendererProps) {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const stringOrNumberTimestamp =
    timestamp instanceof Date ? timestamp.toISOString() : timestamp ?? '';

  const target = getTraceDetailsUrl(
    organization,
    traceId,
    {
      start: selection.datetime.start,
      end: selection.datetime.end,
      statsPeriod: selection.datetime.period,
    },
    {},
    stringOrNumberTimestamp,
    transactionId
  );

  return <Link to={target}>{getShortEventId(traceId)}</Link>;
}

interface TransactionRendererProps {
  projectSlug: string;
  transaction: string;
}

export function TransactionRenderer({
  projectSlug,
  transaction,
}: TransactionRendererProps) {
  const location = useLocation();
  const organization = useOrganization();
  const {projects} = useProjects({slugs: [projectSlug]});

  const target = transactionSummaryRouteWithQuery({
    orgSlug: organization.slug,
    transaction,
    query: {
      ...location.query,
      query: undefined,
    },
    projectID: String(projects[0]?.id ?? ''),
  });

  return <Link to={target}>{transaction}</Link>;
}
