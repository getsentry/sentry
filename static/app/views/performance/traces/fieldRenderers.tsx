import {type Theme, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/button';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import Link from 'sentry/components/links/link';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {ROW_HEIGHT, ROW_PADDING} from 'sentry/components/performance/waterfall/constants';
import {RowRectangle} from 'sentry/components/performance/waterfall/rowBar';
import {pickBarColor} from 'sentry/components/performance/waterfall/utils';
import PerformanceDuration from 'sentry/components/performanceDuration';
import {Tooltip} from 'sentry/components/tooltip';
import {IconIssues} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {DateString} from 'sentry/types/core';
import {generateLinkToEventInTraceView} from 'sentry/utils/discover/urls';
import {getShortEventId} from 'sentry/utils/events';
import toPercent from 'sentry/utils/number/toPercent';
import Projects from 'sentry/utils/projects';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {getTraceDetailsUrl} from 'sentry/views/performance/traceDetails/utils';
import {transactionSummaryRouteWithQuery} from 'sentry/views/performance/transactionSummary/utils';

import {useTraceMeta} from '../newTraceDetails/traceApi/useTraceMeta';

import type {TraceResult} from './content';
import type {Field} from './data';

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

export const TraceBreakdownContainer = styled('div')`
  position: relative;
  display: flex;
  min-width: 150px;
  height: ${ROW_HEIGHT - 2 * ROW_PADDING}px;
  background-color: ${p => p.theme.gray100};
`;

const RectangleTraceBreakdown = styled(RowRectangle)`
  position: relative;
  width: 100%;
`;

export function TraceBreakdownRenderer({trace}: {trace: TraceResult<Field>}) {
  const theme = useTheme();

  return (
    <TraceBreakdownContainer data-test-id="relative-ops-breakdown">
      {trace.breakdowns.map(breakdown => {
        return (
          <SpanBreakdownSliceRenderer
            key={breakdown.start + (breakdown.project ?? t('missing instrumentation'))}
            sliceName={breakdown.project}
            sliceStart={breakdown.start}
            sliceEnd={breakdown.end}
            trace={trace}
            theme={theme}
          />
        );
      })}
    </TraceBreakdownContainer>
  );
}

export function SpanBreakdownSliceRenderer({
  trace,
  theme,
  sliceName,
  sliceStart,
  sliceEnd,
}: {
  sliceEnd: number;
  sliceName: string | null;
  sliceStart: number;
  theme: Theme;
  trace: TraceResult<Field>;
}) {
  const traceDuration = trace.end - trace.start;

  const sliceDuration = sliceEnd - sliceStart;

  if (sliceDuration <= 0) {
    return null;
  }
  const sliceColor = sliceName ? pickBarColor(sliceName) : theme.gray100;
  const slicePercent = toPercent(sliceDuration / traceDuration);
  const relativeSliceStart = sliceStart - trace.start;
  const sliceOffset = toPercent(relativeSliceStart / traceDuration);
  return (
    <div
      style={{
        width: `max(2px, ${slicePercent})`,
        left: sliceOffset,
        position: 'absolute',
        ...(sliceName ? {} : {zIndex: -1}),
      }}
    >
      <Tooltip
        title={
          <div>
            <div>{sliceName}</div>
            <div>
              <PerformanceDuration milliseconds={sliceDuration} abbreviation />
            </div>
          </div>
        }
        containerDisplayMode="block"
      >
        <RectangleTraceBreakdown
          style={{
            backgroundColor: sliceColor,
          }}
          onClick={_ => {}}
        />
      </Tooltip>
    </div>
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
    projectSlug,
    traceSlug: traceId,
    timestamp,
    eventId: transactionId,
    organization,
    location,
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

export function TraceIssuesRenderer({trace}: {trace: TraceResult<Field>}) {
  const traceMeta = useTraceMeta(trace.trace);
  const organization = useOrganization();

  const issueCount = !traceMeta.data
    ? undefined
    : traceMeta.data.errors + traceMeta.data.performance_issues;

  return (
    <LinkButton
      to={normalizeUrl({
        pathname: `/organizations/${organization.slug}/issues`,
        query: {
          query: `is:unresolved trace:"${trace.trace}"`,
        },
      })}
      size="xs"
      icon={<IconIssues size="xs" />}
    >
      {issueCount !== undefined ? (
        issueCount
      ) : (
        <LoadingIndicator
          size={12}
          mini
          style={{height: '12px', width: '12px', margin: 0, marginRight: 0}}
        />
      )}
      {issueCount === 100 && '+'}
    </LinkButton>
  );
}
