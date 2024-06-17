import {useState} from 'react';
import {type Theme, useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import Tag from 'sentry/components/badge/tag';
import {LinkButton} from 'sentry/components/button';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import Link from 'sentry/components/links/link';
import {RowRectangle} from 'sentry/components/performance/waterfall/rowBar';
import {pickBarColor} from 'sentry/components/performance/waterfall/utils';
import PerformanceDuration from 'sentry/components/performanceDuration';
import TimeSince from 'sentry/components/timeSince';
import {Tooltip} from 'sentry/components/tooltip';
import {IconIssues} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {DateString} from 'sentry/types/core';
import {generateLinkToEventInTraceView} from 'sentry/utils/discover/urls';
import {getShortEventId} from 'sentry/utils/events';
import Projects from 'sentry/utils/projects';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {getTraceDetailsUrl} from 'sentry/views/performance/traceDetails/utils';
import {transactionSummaryRouteWithQuery} from 'sentry/views/performance/transactionSummary/utils';
import type {SpanIndexedField, SpanIndexedResponse} from 'sentry/views/starfish/types';

import {TraceViewSources} from '../performance/newTraceDetails/traceMetadataHeader';

import type {SpanResult, TraceResult} from './content';
import type {Field} from './data';
import {getShortenedSdkName, getStylingSliceName} from './utils';

interface ProjectRendererProps {
  projectSlug: string;
  hideName?: boolean;
}

export function SpanDescriptionRenderer({span}: {span: SpanResult<Field>}) {
  return (
    <Description>
      <ProjectRenderer projectSlug={span.project} hideName />
      <strong>{span['span.op']}</strong>
      <em>{'\u2014'}</em>
      <WrappingText>{span['span.description']}</WrappingText>
      {<StatusTag status={span['span.status']} />}
    </Description>
  );
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

const WrappingText = styled('div')`
  ${p => p.theme.overflowEllipsis};
  width: auto;
`;

export const TraceBreakdownContainer = styled('div')<{hoveredIndex?: number}>`
  position: relative;
  display: flex;
  min-width: 200px;
  height: 15px;
  background-color: ${p => p.theme.gray100};
  ${p => `--hoveredSlice-${p.hoveredIndex ?? -1}-translateY: translateY(-3px)`};
`;

const RectangleTraceBreakdown = styled(RowRectangle)<{
  sliceColor: string;
  sliceName: string | null;
  offset?: number;
}>`
  background-color: ${p => p.sliceColor};
  position: relative;
  width: 100%;
  height: 15px;
  ${p => `
    filter: var(--highlightedSlice-${p.sliceName}-saturate, var(--defaultSlice-saturate));
  `}
  ${p => `
    opacity: var(--highlightedSlice-${p.sliceName ?? ''}-opacity, var(--defaultSlice-opacity, 1.0));
  `}
  ${p => `
    transform: var(--hoveredSlice-${p.offset}-translateY, var(--highlightedSlice-${p.sliceName ?? ''}-transform, var(--defaultSlice-transform, 1.0)));
  `}
  transition: filter,opacity,transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
`;

export function TraceBreakdownRenderer({
  trace,
  setHighlightedSliceName,
}: {
  setHighlightedSliceName: (sliceName: string) => void;

  trace: TraceResult<Field>;
}) {
  const theme = useTheme();
  const [hoveredIndex, setHoveredIndex] = useState(-1);

  return (
    <TraceBreakdownContainer
      data-test-id="relative-ops-breakdown"
      hoveredIndex={hoveredIndex}
      onMouseLeave={() => setHoveredIndex(-1)}
    >
      {trace.breakdowns.map((breakdown, index) => {
        return (
          <SpanBreakdownSliceRenderer
            key={breakdown.start + (breakdown.project ?? t('missing instrumentation'))}
            sliceName={breakdown.project}
            sliceStart={breakdown.start}
            sliceEnd={breakdown.end}
            sliceDurationReal={breakdown.duration}
            sliceSecondaryName={breakdown.sdkName}
            sliceNumberStart={breakdown.sliceStart}
            sliceNumberWidth={breakdown.sliceWidth}
            trace={trace}
            theme={theme}
            offset={index}
            onMouseEnter={() => {
              setHoveredIndex(index);
              breakdown.project
                ? setHighlightedSliceName(
                    getStylingSliceName(breakdown.project, breakdown.sdkName) ?? ''
                  )
                : null;
            }}
          />
        );
      })}
    </TraceBreakdownContainer>
  );
}

const BREAKDOWN_SIZE_PX = 200;
export const BREAKDOWN_SLICES = 40;

/**
 * This renders slices in two different ways;
 * - Slices in the breakdown for the trace. These have slice numbers returned for quantization from the backend.
 * - Slices derived from span timings. Spans aren't quantized into slices.
 */
export function SpanBreakdownSliceRenderer({
  trace,
  theme,
  sliceName,
  sliceStart,
  sliceEnd,
  sliceNumberStart,
  sliceNumberWidth,
  sliceDurationReal,
  sliceSecondaryName,
  onMouseEnter,
  offset,
}: {
  onMouseEnter: () => void;
  sliceEnd: number;
  sliceName: string | null;
  sliceSecondaryName: string | null;
  sliceStart: number;
  theme: Theme;
  trace: TraceResult<Field>;
  offset?: number;
  sliceDurationReal?: number;
  sliceNumberStart?: number;
  sliceNumberWidth?: number;
}) {
  const traceDuration = trace.end - trace.start;

  const sliceDuration = sliceEnd - sliceStart;
  const pixelsPerSlice = BREAKDOWN_SIZE_PX / BREAKDOWN_SLICES;
  const relativeSliceStart = sliceStart - trace.start;

  const stylingSliceName = getStylingSliceName(sliceName, sliceSecondaryName);
  const sliceColor = stylingSliceName ? pickBarColor(stylingSliceName) : theme.gray100;

  const sliceWidth =
    sliceNumberWidth !== undefined
      ? pixelsPerSlice * sliceNumberWidth
      : pixelsPerSlice * Math.ceil(BREAKDOWN_SLICES * (sliceDuration / traceDuration));
  const sliceOffset =
    sliceNumberStart !== undefined
      ? pixelsPerSlice * sliceNumberStart
      : pixelsPerSlice *
        Math.floor((BREAKDOWN_SLICES * relativeSliceStart) / traceDuration);

  return (
    <BreakdownSlice
      sliceName={sliceName}
      sliceOffset={sliceOffset}
      sliceWidth={sliceWidth}
      onMouseEnter={onMouseEnter}
    >
      <Tooltip
        title={
          <div>
            <FlexContainer>
              {sliceName ? <ProjectRenderer projectSlug={sliceName} hideName /> : null}
              <strong>{sliceName}</strong>
              <Subtext>({getShortenedSdkName(sliceSecondaryName)})</Subtext>
            </FlexContainer>
            <div>
              <PerformanceDuration
                milliseconds={sliceDurationReal ?? sliceDuration}
                abbreviation
              />
            </div>
          </div>
        }
        containerDisplayMode="block"
      >
        <RectangleTraceBreakdown
          sliceColor={sliceColor}
          sliceName={stylingSliceName}
          offset={offset}
        />
      </Tooltip>
    </BreakdownSlice>
  );
}

const Subtext = styled('span')`
  font-weight: ${p => p.theme.fontWeightNormal};
  color: ${p => p.theme.gray300};
`;
const FlexContainer = styled('div')`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: ${space(0.5)};
  padding-bottom: ${space(0.5)};
`;

const BreakdownSlice = styled('div')<{
  sliceName: string | null;
  sliceOffset: number;
  sliceWidth: number;
}>`
  position: absolute;
  width: max(3px, ${p => p.sliceWidth}px);
  left: ${p => p.sliceOffset}px;
  ${p => (p.sliceName ? null : 'z-index: -1;')}
`;

interface SpanIdRendererProps {
  projectSlug: string;
  spanId: string;
  timestamp: string;
  traceId: string;
  transactionId: string;
  onClick?: () => void;
}

export function SpanIdRenderer({
  projectSlug,
  spanId,
  timestamp,
  traceId,
  transactionId,
  onClick,
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
    source: TraceViewSources.TRACES,
  });

  return (
    <Link to={target} onClick={onClick}>
      {getShortEventId(spanId)}
    </Link>
  );
}

interface TraceIdRendererProps {
  location: Location;
  traceId: string;
  onClick?: () => void;
  timestamp?: DateString;
  transactionId?: string;
}

export function TraceIdRenderer({
  traceId,
  timestamp,
  transactionId,
  location,
  onClick,
}: TraceIdRendererProps) {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const stringOrNumberTimestamp =
    timestamp instanceof Date ? timestamp.toISOString() : timestamp ?? '';

  const target = getTraceDetailsUrl({
    organization,
    traceSlug: traceId,
    dateSelection: {
      start: selection.datetime.start,
      end: selection.datetime.end,
      statsPeriod: selection.datetime.period,
    },
    timestamp: stringOrNumberTimestamp,
    eventId: transactionId,
    location,
    source: TraceViewSources.TRACES,
  });

  return (
    <Link to={target} style={{minWidth: '66px', textAlign: 'right'}} onClick={onClick}>
      {getShortEventId(traceId)}
    </Link>
  );
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

export function TraceIssuesRenderer({
  trace,
  onClick,
}: {
  trace: TraceResult<Field>;
  onClick?: () => void;
}) {
  const organization = useOrganization();

  const issueCount = trace.numErrors + trace.numOccurrences;

  const issueText = issueCount >= 100 ? '99+' : issueCount === 0 ? '\u2014' : issueCount;

  return (
    <LinkButton
      to={normalizeUrl({
        pathname: `/organizations/${organization.slug}/issues`,
        query: {
          query: `trace:"${trace.trace}"`,
        },
      })}
      onClick={onClick}
      size="xs"
      icon={<IconIssues size="xs" />}
      disabled={issueCount === 0}
      style={{minHeight: '24px', height: '24px', minWidth: '44px'}}
    >
      {issueText}
    </LinkButton>
  );
}

export function SpanTimeRenderer({
  timestamp,
  tooltipShowSeconds,
}: {
  timestamp: number;
  tooltipShowSeconds?: boolean;
}) {
  const date = new Date(timestamp);
  return (
    <TimeSince
      unitStyle="extraShort"
      date={date}
      tooltipShowSeconds={tooltipShowSeconds}
    />
  );
}

type SpanStatus = SpanIndexedResponse[SpanIndexedField.SPAN_STATUS];

const STATUS_TO_TAG_TYPE: Record<SpanStatus, keyof Theme['tag']> = {
  ok: 'success',
  cancelled: 'warning',
  unknown: 'info',
  invalid_argument: 'warning',
  deadline_exceeded: 'error',
  not_found: 'warning',
  already_exists: 'warning',
  permission_denied: 'warning',
  resource_exhausted: 'warning',
  failed_precondition: 'warning',
  aborted: 'warning',
  out_of_range: 'warning',
  unimplemented: 'error',
  internal_error: 'error',
  unavailable: 'error',
  data_loss: 'error',
  unauthenticated: 'warning',
};

function statusToTagType(status: string) {
  return STATUS_TO_TAG_TYPE[status];
}

const OMITTED_SPAN_STATUS = ['unknown'];

/**
 * This display a tag for the status (not to be confused with 'status_code' which has values like '200', '429').
 */
export function StatusTag({status, onClick}: {status: string; onClick?: () => void}) {
  const tagType = statusToTagType(status);

  if (!tagType) {
    return null;
  }

  if (OMITTED_SPAN_STATUS.includes(status)) {
    return null;
  }
  return (
    <StyledTag type={tagType} onClick={onClick} borderStyle="solid">
      {status}
    </StyledTag>
  );
}

const StyledTag = styled(Tag)`
  cursor: ${p => (p.onClick ? 'pointer' : 'default')};
`;

const Description = styled('div')`
  ${p => p.theme.overflowEllipsis};
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: ${space(1)};
`;
