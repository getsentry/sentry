import {Fragment, useCallback, useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';
import omit from 'lodash/omit';
import moment from 'moment-timezone';

import {Alert} from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import Count from 'sentry/components/count';
import EmptyStateWarning, {EmptyStreamWrapper} from 'sentry/components/emptyStateWarning';
import * as Layout from 'sentry/components/layouts/thirds';
import ExternalLink from 'sentry/components/links/externalLink';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import Panel from 'sentry/components/panels/panel';
import PanelHeader from 'sentry/components/panels/panelHeader';
import PanelItem from 'sentry/components/panels/panelItem';
import PerformanceDuration from 'sentry/components/performanceDuration';
import {IconChevron} from 'sentry/icons/iconChevron';
import {IconClose} from 'sentry/icons/iconClose';
import {IconWarning} from 'sentry/icons/iconWarning';
import {t, tct} from 'sentry/locale';
import type {MetricAggregation, MRI} from 'sentry/types/metrics';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {browserHistory} from 'sentry/utils/browserHistory';
import {getUtcDateString} from 'sentry/utils/dates';
import {getFormattedMQL} from 'sentry/utils/metrics';
import {decodeInteger, decodeList} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import * as ModuleLayout from 'sentry/views/insights/common/components/moduleLayout';

import {usePageParams} from './hooks/usePageParams';
import type {TraceResult} from './hooks/useTraces';
import {useTraces} from './hooks/useTraces';
import type {SpanResult} from './hooks/useTraceSpans';
import {useTraceSpans} from './hooks/useTraceSpans';
import {type Field, FIELDS, SORTS} from './data';
import {
  Description,
  ProjectBadgeWrapper,
  ProjectsRenderer,
  SpanBreakdownSliceRenderer,
  SpanDescriptionRenderer,
  SpanIdRenderer,
  SpanTimeRenderer,
  TraceBreakdownContainer,
  TraceBreakdownRenderer,
  TraceIdRenderer,
  TraceIssuesRenderer,
} from './fieldRenderers';
import {TracesChart} from './tracesChart';
import {TracesSearchBar} from './tracesSearchBar';
import {
  areQueriesEmpty,
  getSecondaryNameFromSpan,
  getStylingSliceName,
  normalizeTraces,
} from './utils';

const DEFAULT_PER_PAGE = 50;
const SPAN_PROPS_DOCS_URL =
  'https://docs.sentry.io/concepts/search/searchable-properties/spans/';
const ONE_MINUTE = 60 * 1000; // in milliseconds

export function Content() {
  const location = useLocation();

  const limit = useMemo(() => {
    return decodeInteger(location.query.perPage, DEFAULT_PER_PAGE);
  }, [location.query.perPage]);

  const {queries, metricsMax, metricsMin, metricsOp, metricsQuery, mri} =
    usePageParams(location);

  const hasMetric = metricsOp && mri;

  const removeMetric = useCallback(() => {
    browserHistory.push({
      ...location,
      query: omit(location.query, [
        'mri',
        'metricsOp',
        'metricsQuery',
        'metricsMax',
        'metricsMin',
      ]),
    });
  }, [location]);

  const handleSearch = useCallback(
    (searchIndex: number, searchQuery: string) => {
      const newQueries = [...queries];
      if (newQueries.length === 0) {
        // In the odd case someone wants to add search bars before any query has been made, we add both the default one shown and a new one.
        newQueries[0] = '';
      }
      newQueries[searchIndex] = searchQuery;
      browserHistory.push({
        ...location,
        query: {
          ...location.query,
          cursor: undefined,
          query: typeof searchQuery === 'string' ? newQueries : queries,
        },
      });
    },
    [location, queries]
  );

  const handleClearSearch = useCallback(
    (searchIndex: number) => {
      const newQueries = [...queries];
      if (typeof newQueries[searchIndex] !== undefined) {
        delete newQueries[searchIndex];
        browserHistory.push({
          ...location,
          query: {
            ...location.query,
            cursor: undefined,
            query: newQueries,
          },
        });
        return true;
      }
      return false;
    },
    [location, queries]
  );

  const tracesQuery = useTraces({
    limit,
    query: queries,
    mri: hasMetric ? mri : undefined,
    metricsMax: hasMetric ? metricsMax : undefined,
    metricsMin: hasMetric ? metricsMin : undefined,
    metricsOp: hasMetric ? metricsOp : undefined,
    metricsQuery: hasMetric ? metricsQuery : undefined,
  });

  const isLoading = tracesQuery.isFetching;
  const isError = !isLoading && tracesQuery.isError;
  const isEmpty = !isLoading && !isError && (tracesQuery?.data?.data?.length ?? 0) === 0;
  const rawData = !isLoading && !isError ? tracesQuery?.data?.data : undefined;
  const data = normalizeTraces(rawData);

  return (
    <LayoutMain fullWidth>
      <PageFilterBar condensed>
        <ProjectPageFilter />
        <EnvironmentPageFilter />
        <DatePageFilter defaultPeriod="2h" />
      </PageFilterBar>
      {hasMetric && (
        <StyledAlert
          type="info"
          showIcon
          trailingItems={<StyledCloseButton onClick={removeMetric} />}
        >
          {tct('The metric query [metricQuery] is filtering the results below.', {
            metricQuery: (
              <strong>
                {getFormattedMQL({
                  mri: mri as MRI,
                  aggregation: metricsOp as MetricAggregation,
                  query: metricsQuery,
                })}
              </strong>
            ),
          })}
        </StyledAlert>
      )}
      {isError && typeof tracesQuery.error?.responseJSON?.detail === 'string' ? (
        <StyledAlert type="error" showIcon>
          {tracesQuery.error?.responseJSON?.detail}
        </StyledAlert>
      ) : null}
      <TracesSearchBar
        queries={queries}
        handleSearch={handleSearch}
        handleClearSearch={handleClearSearch}
      />

      <ModuleLayout.Full>
        <TracesChart />
      </ModuleLayout.Full>
      <StyledPanel>
        <TracePanelContent>
          <StyledPanelHeader align="left" lightText>
            {t('Trace ID')}
          </StyledPanelHeader>
          <StyledPanelHeader align="left" lightText>
            {t('Trace Root')}
          </StyledPanelHeader>
          <StyledPanelHeader align="right" lightText>
            {areQueriesEmpty(queries) ? t('Total Spans') : t('Matching Spans')}
          </StyledPanelHeader>
          <StyledPanelHeader align="left" lightText>
            {t('Timeline')}
          </StyledPanelHeader>
          <StyledPanelHeader align="right" lightText>
            {t('Duration')}
          </StyledPanelHeader>
          <StyledPanelHeader align="right" lightText>
            {t('Timestamp')}
          </StyledPanelHeader>
          <StyledPanelHeader align="right" lightText>
            {t('Issues')}
          </StyledPanelHeader>
          {isLoading && (
            <StyledPanelItem span={7} overflow>
              <LoadingIndicator />
            </StyledPanelItem>
          )}
          {isError && ( // TODO: need an error state
            <StyledPanelItem span={7} overflow>
              <EmptyStreamWrapper>
                <IconWarning color="gray300" size="lg" />
              </EmptyStreamWrapper>
            </StyledPanelItem>
          )}
          {isEmpty && (
            <StyledPanelItem span={7} overflow>
              <EmptyStateWarning withIcon>
                <EmptyStateText size="fontSizeExtraLarge">
                  {t('No trace results found')}
                </EmptyStateText>
                <EmptyStateText size="fontSizeMedium">
                  {tct('Try adjusting your filters or refer to [docSearchProps].', {
                    docSearchProps: (
                      <ExternalLink href={SPAN_PROPS_DOCS_URL}>
                        {t('docs for search properties')}
                      </ExternalLink>
                    ),
                  })}
                </EmptyStateText>
              </EmptyStateWarning>
            </StyledPanelItem>
          )}
          {data?.map((trace, i) => (
            <TraceRow
              key={trace.trace}
              trace={trace}
              defaultExpanded={!areQueriesEmpty(queries) && i === 0}
            />
          ))}
        </TracePanelContent>
      </StyledPanel>
    </LayoutMain>
  );
}

function TraceRow({defaultExpanded, trace}: {defaultExpanded; trace: TraceResult}) {
  const {selection} = usePageFilters();
  const {projects} = useProjects();

  const [expanded, setExpanded] = useState<boolean>(defaultExpanded);
  const [highlightedSliceName, _setHighlightedSliceName] = useState('');
  const location = useLocation();
  const organization = useOrganization();
  const queries = useMemo(() => {
    return decodeList(location.query.query);
  }, [location.query.query]);

  const setHighlightedSliceName = useMemo(
    () =>
      debounce(sliceName => _setHighlightedSliceName(sliceName), 100, {
        leading: true,
      }),
    [_setHighlightedSliceName]
  );

  const onClickExpand = useCallback(() => setExpanded(e => !e), [setExpanded]);

  const selectedProjects = useMemo(() => {
    const selectedProjectIds = new Set(
      selection.projects.map(project => project.toString())
    );
    return new Set(
      projects
        .filter(project => selectedProjectIds.has(project.id))
        .map(project => project.slug)
    );
  }, [projects, selection.projects]);

  const traceProjects = useMemo(() => {
    const seenProjects: Set<string> = new Set();

    const leadingProjects: string[] = [];
    const trailingProjects: string[] = [];

    for (let i = 0; i < trace.breakdowns.length; i++) {
      const project = trace.breakdowns[i].project;
      if (!defined(project) || seenProjects.has(project)) {
        continue;
      }
      seenProjects.add(project);

      // Priotize projects that are selected in the page filters
      if (selectedProjects.has(project)) {
        leadingProjects.push(project);
      } else {
        trailingProjects.push(project);
      }
    }

    return [...leadingProjects, ...trailingProjects];
  }, [selectedProjects, trace]);

  return (
    <Fragment>
      <StyledPanelItem align="center" center onClick={onClickExpand}>
        <Button
          icon={<IconChevron size="xs" direction={expanded ? 'down' : 'right'} />}
          aria-label={t('Toggle trace details')}
          aria-expanded={expanded}
          size="zero"
          borderless
          onClick={() =>
            trackAnalytics('trace_explorer.toggle_trace_details', {
              organization,
              expanded,
            })
          }
        />
        <TraceIdRenderer
          traceId={trace.trace}
          timestamp={trace.end}
          onClick={() =>
            trackAnalytics('trace_explorer.open_trace', {
              organization,
            })
          }
          location={location}
        />
      </StyledPanelItem>
      <StyledPanelItem align="left" overflow>
        <Description>
          <ProjectBadgeWrapper>
            <ProjectsRenderer
              projectSlugs={
                traceProjects.length > 0
                  ? traceProjects
                  : trace.project
                    ? [trace.project]
                    : []
              }
            />
          </ProjectBadgeWrapper>
          {trace.name ? (
            <WrappingText>{trace.name}</WrappingText>
          ) : (
            <EmptyValueContainer>{t('Missing Trace Root')}</EmptyValueContainer>
          )}
        </Description>
      </StyledPanelItem>
      <StyledPanelItem align="right">
        {areQueriesEmpty(queries) ? (
          <Count value={trace.numSpans} />
        ) : (
          tct('[numerator][space]of[space][denominator]', {
            numerator: <Count value={trace.matchingSpans} />,
            denominator: <Count value={trace.numSpans} />,
            space: <Fragment>&nbsp;</Fragment>,
          })
        )}
      </StyledPanelItem>
      <BreakdownPanelItem
        align="right"
        highlightedSliceName={highlightedSliceName}
        onMouseLeave={() => setHighlightedSliceName('')}
      >
        <TraceBreakdownRenderer
          trace={trace}
          setHighlightedSliceName={setHighlightedSliceName}
        />
      </BreakdownPanelItem>
      <StyledPanelItem align="right">
        <PerformanceDuration milliseconds={trace.duration} abbreviation />
      </StyledPanelItem>
      <StyledPanelItem align="right">
        <SpanTimeRenderer timestamp={trace.end} tooltipShowSeconds />
      </StyledPanelItem>
      <StyledPanelItem align="right">
        <TraceIssuesRenderer
          trace={trace}
          onClick={() =>
            trackAnalytics('trace_explorer.open_in_issues', {
              organization,
            })
          }
        />
      </StyledPanelItem>
      {expanded && (
        <SpanTable trace={trace} setHighlightedSliceName={setHighlightedSliceName} />
      )}
    </Fragment>
  );
}

function SpanTable({
  trace,
  setHighlightedSliceName,
}: {
  setHighlightedSliceName: (sliceName: string) => void;
  trace: TraceResult;
}) {
  const location = useLocation();
  const organization = useOrganization();

  const {queries, metricsMax, metricsMin, metricsOp, metricsQuery, mri} =
    usePageParams(location);
  const hasMetric = metricsOp && mri;

  const spansQuery = useTraceSpans({
    trace,
    fields: [
      ...FIELDS,
      ...SORTS.map(field =>
        field.startsWith('-') ? (field.substring(1) as Field) : (field as Field)
      ),
    ],
    datetime: {
      // give a 1 minute buffer on each side so that start != end
      start: getUtcDateString(moment(trace.start - ONE_MINUTE)),
      end: getUtcDateString(moment(trace.end + ONE_MINUTE)),
      period: null,
      utc: true,
    },
    limit: 10,
    query: queries,
    sort: SORTS,
    mri: hasMetric ? mri : undefined,
    metricsMax: hasMetric ? metricsMax : undefined,
    metricsMin: hasMetric ? metricsMin : undefined,
    metricsOp: hasMetric ? metricsOp : undefined,
    metricsQuery: hasMetric ? metricsQuery : undefined,
  });

  const isLoading = spansQuery.isFetching;
  const isError = !isLoading && spansQuery.isError;
  const hasData = !isLoading && !isError && (spansQuery?.data?.data?.length ?? 0) > 0;
  const spans = spansQuery.data?.data ?? [];

  return (
    <SpanTablePanelItem span={7} overflow>
      <StyledPanel>
        <SpanPanelContent>
          <StyledPanelHeader align="left" lightText>
            {t('Span ID')}
          </StyledPanelHeader>
          <StyledPanelHeader align="left" lightText>
            {t('Span Description')}
          </StyledPanelHeader>
          <StyledPanelHeader align="right" lightText />
          <StyledPanelHeader align="right" lightText>
            {t('Span Duration')}
          </StyledPanelHeader>
          <StyledPanelHeader align="right" lightText>
            {t('Timestamp')}
          </StyledPanelHeader>
          {isLoading && (
            <StyledPanelItem span={5} overflow>
              <LoadingIndicator />
            </StyledPanelItem>
          )}
          {isError && ( // TODO: need an error state
            <StyledPanelItem span={5} overflow>
              <EmptyStreamWrapper>
                <IconWarning color="gray300" size="lg" />
              </EmptyStreamWrapper>
            </StyledPanelItem>
          )}
          {spans.map(span => (
            <SpanRow
              organization={organization}
              key={span.id}
              span={span}
              trace={trace}
              setHighlightedSliceName={setHighlightedSliceName}
            />
          ))}
          {hasData && spans.length < trace.matchingSpans && (
            <MoreMatchingSpans span={5}>
              {tct('[more][space]more [matching]spans can be found in the trace.', {
                more: <Count value={trace.matchingSpans - spans.length} />,
                space: <Fragment>&nbsp;</Fragment>,
                matching: areQueriesEmpty(queries) ? '' : 'matching ',
              })}
            </MoreMatchingSpans>
          )}
        </SpanPanelContent>
      </StyledPanel>
    </SpanTablePanelItem>
  );
}

function SpanRow({
  organization,
  span,
  trace,
  setHighlightedSliceName,
}: {
  organization: Organization;
  setHighlightedSliceName: (sliceName: string) => void;
  span: SpanResult<Field>;

  trace: TraceResult;
}) {
  const theme = useTheme();
  return (
    <Fragment>
      <StyledSpanPanelItem align="right">
        <SpanIdRenderer
          projectSlug={span.project}
          transactionId={span['transaction.id']}
          spanId={span.id}
          traceId={trace.trace}
          timestamp={span.timestamp}
          onClick={() =>
            trackAnalytics('trace_explorer.open_trace_span', {
              organization,
            })
          }
        />
      </StyledSpanPanelItem>
      <StyledSpanPanelItem align="left" overflow>
        <SpanDescriptionRenderer span={span} />
      </StyledSpanPanelItem>
      <StyledSpanPanelItem align="right" onMouseLeave={() => setHighlightedSliceName('')}>
        <TraceBreakdownContainer>
          <SpanBreakdownSliceRenderer
            sliceName={span.project}
            sliceSecondaryName={getSecondaryNameFromSpan(span)}
            sliceStart={Math.ceil(span['precise.start_ts'] * 1000)}
            sliceEnd={Math.floor(span['precise.finish_ts'] * 1000)}
            trace={trace}
            theme={theme}
            onMouseEnter={() =>
              setHighlightedSliceName(
                getStylingSliceName(span.project, getSecondaryNameFromSpan(span)) ?? ''
              )
            }
          />
        </TraceBreakdownContainer>
      </StyledSpanPanelItem>
      <StyledSpanPanelItem align="right">
        <PerformanceDuration milliseconds={span['span.duration']} abbreviation />
      </StyledSpanPanelItem>

      <StyledSpanPanelItem align="right">
        <SpanTimeRenderer
          timestamp={span['precise.finish_ts'] * 1000}
          tooltipShowSeconds
        />
      </StyledSpanPanelItem>
    </Fragment>
  );
}

const LayoutMain = styled(Layout.Main)`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space(2)};
`;

const StyledPanel = styled(Panel)`
  margin-bottom: 0px;
`;

const TracePanelContent = styled('div')`
  width: 100%;
  display: grid;
  grid-template-columns: 116px auto repeat(2, min-content) 85px 112px 66px;
`;

const SpanPanelContent = styled('div')`
  width: 100%;
  display: grid;
  grid-template-columns: 100px auto repeat(1, min-content) 160px 85px;
`;

const StyledPanelHeader = styled(PanelHeader)<{align: 'left' | 'right'}>`
  white-space: nowrap;
  justify-content: ${p => (p.align === 'left' ? 'flex-start' : 'flex-end')};
`;

const EmptyStateText = styled('div')<{size: 'fontSizeExtraLarge' | 'fontSizeMedium'}>`
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme[p.size]};
  padding-bottom: ${p => p.theme.space(1)};
`;

const StyledPanelItem = styled(PanelItem)<{
  align?: 'left' | 'center' | 'right';
  overflow?: boolean;
  span?: number;
}>`
  align-items: center;
  padding: ${p => p.theme.space(1)} ${p => p.theme.space(2)};
  ${p => (p.align === 'left' ? 'justify-content: flex-start;' : null)}
  ${p => (p.align === 'right' ? 'justify-content: flex-end;' : null)}
  ${p => (p.overflow ? p.theme.overflowEllipsis : null)};
  ${p =>
    p.align === 'center'
      ? `
  justify-content: space-around;`
      : p.align === 'left' || p.align === 'right'
        ? `text-align: ${p.align};`
        : undefined}
  ${p => p.span && `grid-column: auto / span ${p.span};`}
  white-space: nowrap;
`;

const MoreMatchingSpans = styled(StyledPanelItem)`
  color: ${p => p.theme.gray300};
`;

const WrappingText = styled('div')`
  width: 100%;
  ${p => p.theme.overflowEllipsis};
`;

const StyledSpanPanelItem = styled(StyledPanelItem)`
  &:nth-child(10n + 1),
  &:nth-child(10n + 2),
  &:nth-child(10n + 3),
  &:nth-child(10n + 4),
  &:nth-child(10n + 5) {
    background-color: ${p => p.theme.backgroundSecondary};
  }
`;

const SpanTablePanelItem = styled(StyledPanelItem)`
  background-color: ${p => p.theme.gray100};
`;

const BreakdownPanelItem = styled(StyledPanelItem)<{highlightedSliceName: string}>`
  ${p =>
    p.highlightedSliceName
      ? `--highlightedSlice-${p.highlightedSliceName}-opacity: 1.0;
         --highlightedSlice-${p.highlightedSliceName}-saturate: saturate(1.0) contrast(1.0);
         --highlightedSlice-${p.highlightedSliceName}-transform: translateY(0px);
       `
      : null}
  ${p =>
    p.highlightedSliceName
      ? `
        --defaultSlice-opacity: 1.0;
        --defaultSlice-saturate: saturate(0.7) contrast(0.9) brightness(1.2);
        --defaultSlice-transform: translateY(0px);
        `
      : `
        --defaultSlice-opacity: 1.0;
        --defaultSlice-saturate: saturate(1.0) contrast(1.0);
        --defaultSlice-transform: translateY(0px);
        `}
`;

const EmptyValueContainer = styled('span')`
  color: ${p => p.theme.gray300};
`;

const StyledAlert = styled(Alert)`
  margin-bottom: 0;
`;

const StyledCloseButton = styled(IconClose)`
  cursor: pointer;
`;
