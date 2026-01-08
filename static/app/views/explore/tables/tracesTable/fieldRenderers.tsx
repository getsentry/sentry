import {useState} from 'react';
import {css, useTheme, type Theme} from '@emotion/react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import {Container} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {Stack} from '@sentry/scraps/layout';

import {Tag, type TagProps} from 'sentry/components/core/badge/tag';
import {Link} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {RowRectangle} from 'sentry/components/performance/waterfall/rowBar';
import {pickBarColor} from 'sentry/components/performance/waterfall/utils';
import PerformanceDuration from 'sentry/components/performanceDuration';
import TimeSince from 'sentry/components/timeSince';
import {t, tct, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {generateLinkToEventInTraceView} from 'sentry/utils/discover/urls';
import {getShortEventId} from 'sentry/utils/events';
import Projects from 'sentry/utils/projects';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import type {TraceResult} from 'sentry/views/explore/hooks/useTraces';
import {BREAKDOWN_SLICES} from 'sentry/views/explore/hooks/useTraces';
import type {SpanResult} from 'sentry/views/explore/tables/tracesTable/types';
import type {SpanFields, SpanResponse} from 'sentry/views/insights/types';
import {TraceViewSources} from 'sentry/views/performance/newTraceDetails/traceHeader/breadcrumbs';
import {getTraceDetailsUrl} from 'sentry/views/performance/traceDetails/utils';

import type {Field} from './data';
import {
  getShortenedSdkName,
  getSimilarEventsUrl,
  getStylingSliceName,
  isPartialSpanOrTraceData,
} from './utils';

export const ProjectBadgeWrapper = styled('span')`
  /**
   * Max of 2 visible projects, 16px each, 2px border, 8px overlap.
   */
  width: 32px;
  min-width: 32px;
`;

export function SpanDescriptionRenderer({span}: {span: SpanResult<Field>}) {
  return (
    <Description data-test-id="span-description">
      <ProjectBadgeWrapper>
        <ProjectRenderer projectSlug={span.project} hideName />
      </ProjectBadgeWrapper>
      <strong>{span['span.op']}</strong>
      <em>{'\u2014'}</em>
      <WrappingText>{span['span.description']}</WrappingText>
      {<StatusTag status={span['span.status']} />}
    </Description>
  );
}

interface ProjectsRendererProps {
  projectSlugs: string[];
  disableLink?: boolean;
  maxVisibleProjects?: number;
  onProjectClick?: (projectSlug: string) => void;
  visibleAvatarSize?: number;
}

export function ProjectsRenderer({
  projectSlugs,
  visibleAvatarSize,
  maxVisibleProjects = 2,
  onProjectClick,
  disableLink,
}: ProjectsRendererProps) {
  const organization = useOrganization();
  const {projects} = useProjects({slugs: projectSlugs, orgId: organization.slug});
  // ensure that projectAvatars is in the same order as the projectSlugs prop
  const projectAvatars = projectSlugs.map(slug => {
    return projects.find(project => project.slug === slug) ?? {slug};
  });
  const numProjects = projectAvatars.length;
  const numVisibleProjects =
    maxVisibleProjects - numProjects >= 0 ? numProjects : maxVisibleProjects - 1;
  const visibleProjectAvatars = projectAvatars.slice(0, numVisibleProjects).reverse();
  const collapsedProjectAvatars = projectAvatars.slice(numVisibleProjects);
  const numCollapsedProjects = collapsedProjectAvatars.length;

  return (
    <ProjectList>
      {numCollapsedProjects > 0 && (
        <Tooltip
          skipWrapper
          title={
            <Stack gap="xs" width="200px">
              {tn(
                'This trace contains %s more project.',
                'This trace contains %s more projects.',
                numCollapsedProjects
              )}
              {collapsedProjectAvatars.map(project => (
                <ProjectBadge key={project.slug} project={project} avatarSize={16} />
              ))}
            </Stack>
          }
        >
          <CollapsedBadge size={20} fontSize={10} data-test-id="collapsed-projects-badge">
            +{numCollapsedProjects}
          </CollapsedBadge>
        </Tooltip>
      )}
      {visibleProjectAvatars.map(project => (
        <StyledProjectBadge
          hideName
          key={project.slug}
          onClick={() => onProjectClick?.(project.slug)}
          disableLink={disableLink}
          project={project}
          avatarSize={visibleAvatarSize ?? 16}
          avatarProps={{hasTooltip: true, tooltip: project.slug}}
        />
      ))}
    </ProjectList>
  );
}

const ProjectList = styled('div')`
  display: flex;
  align-items: center;
  flex-direction: row-reverse;
  justify-content: flex-end;
  padding-right: 8px;
`;

const AvatarStyle = (p: any) => css`
  border: 2px solid ${p.theme.tokens.background.primary};
  margin-right: -8px;
  cursor: default;

  &:hover {
    z-index: 1;
  }
`;

const StyledProjectBadge = styled(ProjectBadge)`
  overflow: hidden;
  z-index: 0;
  ${AvatarStyle}
`;

const CollapsedBadge = styled('div')<{fontSize: number; size: number}>`
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  text-align: center;
  font-weight: ${p => p.theme.fontWeight.bold};
  background-color: ${p => p.theme.colors.gray200};
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.fontSize}px;
  width: ${p => p.size}px;
  height: ${p => p.size}px;
  border-radius: ${p => p.theme.radius.md};
  ${AvatarStyle}
`;

interface ProjectRendererProps {
  projectSlug: string;
  hideName?: boolean;
}

function ProjectRenderer({projectSlug, hideName}: ProjectRendererProps) {
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
            avatarProps={{hasTooltip: true, tooltip: projectSlug}}
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
  background-color: ${p => p.theme.colors.gray100};
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
  ${p => css`
    filter: var(--highlightedSlice-${p.sliceName}-saturate, var(--defaultSlice-saturate));
  `}
  ${p => css`
    opacity: var(
      --highlightedSlice-${p.sliceName ?? ''}-opacity,
      var(--defaultSlice-opacity, 1)
    );
  `}
  ${p => css`
    transform: var(
      --hoveredSlice-${p.offset}-translateY,
      var(
        --highlightedSlice-${p.sliceName ?? ''}-transform,
        var(--defaultSlice-transform, 1)
      )
    );
  `}
  transition: filter,opacity,transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
`;

export function TraceBreakdownRenderer({
  trace,
  setHighlightedSliceName,
}: {
  setHighlightedSliceName: (sliceName: string) => void;

  trace: TraceResult;
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
              if (breakdown.project) {
                setHighlightedSliceName(
                  getStylingSliceName(breakdown.project, breakdown.sdkName) ?? ''
                );
              }
            }}
          />
        );
      })}
    </TraceBreakdownContainer>
  );
}

const BREAKDOWN_SIZE_PX = 200;

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
  sliceEnd: number;
  sliceName: string | null;
  sliceSecondaryName: string | null;
  sliceStart: number;
  theme: Theme;
  trace: TraceResult;
  offset?: number;
  onMouseEnter?: () => void;
  sliceDurationReal?: number;
  sliceNumberStart?: number;
  sliceNumberWidth?: number;
}) {
  const traceDuration = trace.end - trace.start;

  const sliceDuration = sliceEnd - sliceStart;
  const pixelsPerSlice = BREAKDOWN_SIZE_PX / BREAKDOWN_SLICES;
  const relativeSliceStart = sliceStart - trace.start;

  const stylingSliceName = getStylingSliceName(sliceName, sliceSecondaryName);
  const sliceColor = stylingSliceName
    ? pickBarColor(stylingSliceName, theme)
    : theme.colors.gray100;

  const sliceWidth =
    sliceNumberWidth === undefined
      ? pixelsPerSlice * Math.ceil(BREAKDOWN_SLICES * (sliceDuration / traceDuration))
      : pixelsPerSlice * sliceNumberWidth;
  const sliceOffset =
    sliceNumberStart === undefined
      ? pixelsPerSlice *
        Math.floor((BREAKDOWN_SLICES * relativeSliceStart) / traceDuration)
      : pixelsPerSlice * sliceNumberStart;

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
  font-weight: ${p => p.theme.fontWeight.normal};
  color: ${p => p.theme.tokens.content.secondary};
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
  spanDescription: string | null;
  spanId: string;
  spanOp: string;
  spanProject: string;
  timestamp: string;
  traceId: string;
  transactionId: string;
  onClick?: () => void;
}

export function SpanIdRenderer({
  spanId,
  timestamp,
  traceId,
  transactionId,
  onClick,
  spanDescription,
  spanOp,
  spanProject,
}: SpanIdRendererProps) {
  const location = useLocation();
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const shortSpanId = getShortEventId(spanId);

  const {projects} = useProjects({slugs: [spanProject]});
  const projectIds = projects
    .filter(project => defined(project.id))
    .map(project => parseInt(project.id, 10));

  if (isPartialSpanOrTraceData(timestamp)) {
    const search = new MutableSearch('');
    if (spanOp) {
      search.addFilterValue('span.op', spanOp);
    }

    if (spanDescription) {
      search.addFilterValue('span.description', spanDescription);
    }

    return (
      <Tooltip
        showUnderline
        isHoverable
        title={
          <Text>
            {tct('Span is older than 30 days. [similarSpans] in the past 24 hours.', {
              similarSpans: (
                <Link
                  to={getSimilarEventsUrl({
                    queryString: search.formatString(),
                    organization,
                    projectIds,
                    selection: {
                      ...selection,
                      projects: projectIds,
                      datetime: {start: null, end: null, utc: null, period: '24h'},
                    },
                  })}
                >
                  {t('View similar spans')}
                </Link>
              ),
            })}
          </Text>
        }
      >
        <Text variant="muted">{shortSpanId}</Text>
      </Tooltip>
    );
  }

  const target = generateLinkToEventInTraceView({
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
      {shortSpanId}
    </Link>
  );
}

interface TraceIdRendererProps {
  location: Location;
  projectSlugs: string[];
  timestamp: number; // in milliseconds
  traceId: string;
  traceName: string | null;
  onClick?: React.ComponentProps<typeof Link>['onClick'];
  transactionId?: string;
}

export function TraceIdRenderer({
  traceId,
  timestamp,
  transactionId,
  location,
  onClick,
  traceName,
  projectSlugs,
}: TraceIdRendererProps) {
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const shortId = getShortEventId(traceId);

  const {projects} = useProjects({slugs: projectSlugs, orgId: organization.slug});
  const projectIds = projects
    .filter(project => defined(project.id))
    .map(project => parseInt(project.id, 10));

  if (isPartialSpanOrTraceData(timestamp)) {
    const search = new MutableSearch('');
    if (traceName) {
      search.addOp('(');
      search.addFilterValue('transaction', traceName);
      search.addOp('OR');
      search.addFilterValue('span.op', traceName);
      search.addOp('OR');
      search.addFilterValue('span.description', traceName);
      search.addOp(')');
    }

    return (
      <Tooltip
        showUnderline
        isHoverable
        title={
          <Text>
            {tct('Trace is older than 30 days. [similarTraces] in the past 24 hours.', {
              similarTraces: (
                <Link
                  to={getSimilarEventsUrl({
                    queryString: search.formatString(),
                    table: 'trace',
                    organization,
                    projectIds,
                    selection,
                  })}
                >
                  {t('View similar traces')}
                </Link>
              ),
            })}
          </Text>
        }
      >
        <Container minWidth="66px">
          {props => (
            <Text variant="muted" aria-disabled="true" role="link" {...props}>
              {shortId}
            </Text>
          )}
        </Container>
      </Tooltip>
    );
  }

  const target = getTraceDetailsUrl({
    organization,
    traceSlug: traceId,
    dateSelection: {
      start: selection.datetime.start,
      end: selection.datetime.end,
      statsPeriod: selection.datetime.period,
    },
    timestamp: timestamp / 1000,
    eventId: transactionId,
    location,
    source: TraceViewSources.TRACES,
  });

  return (
    <Container minWidth="66px">
      {props => (
        <Link to={target} style={{textAlign: 'right'}} onClick={onClick} {...props}>
          {shortId}
        </Link>
      )}
    </Container>
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

type SpanStatus = SpanResponse[SpanFields.SPAN_STATUS];

const STATUS_TO_TAG_TYPE: Record<SpanStatus, TagProps['variant']> = {
  ok: 'success',
  cancelled: 'warning',
  unknown: 'info',
  invalid_argument: 'warning',
  deadline_exceeded: 'danger',
  not_found: 'warning',
  already_exists: 'warning',
  permission_denied: 'warning',
  resource_exhausted: 'warning',
  failed_precondition: 'warning',
  aborted: 'warning',
  out_of_range: 'warning',
  unimplemented: 'danger',
  internal_error: 'danger',
  unavailable: 'danger',
  data_loss: 'danger',
  unauthenticated: 'warning',
};

function statusToTagType(status: string) {
  // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  return STATUS_TO_TAG_TYPE[status];
}

const OMITTED_SPAN_STATUS = ['unknown'];

/**
 * This display a tag for the status (not to be confused with 'status_code' which has values like '200', '429').
 */
function StatusTag({status, onClick}: {status: string; onClick?: () => void}) {
  const tagType = statusToTagType(status);

  if (!tagType) {
    return null;
  }

  if (OMITTED_SPAN_STATUS.includes(status)) {
    return null;
  }
  return (
    <StyledTag variant={tagType} onClick={onClick}>
      {status}
    </StyledTag>
  );
}

const StyledTag = styled(Tag)`
  cursor: ${p => (p.onClick ? 'pointer' : 'default')};
`;

export const Description = styled('div')`
  ${p => p.theme.overflowEllipsis};
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: ${space(1)};
`;
