import {Fragment, useCallback, useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';
import omit from 'lodash/omit';

import {Alert} from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import Count from 'sentry/components/count';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import Panel from 'sentry/components/panels/panel';
import PanelHeader from 'sentry/components/panels/panelHeader';
import PanelItem from 'sentry/components/panels/panelItem';
import PerformanceDuration from 'sentry/components/performanceDuration';
import {IconChevron} from 'sentry/icons/iconChevron';
import {IconClose} from 'sentry/icons/iconClose';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {PageFilters} from 'sentry/types/core';
import type {MRI} from 'sentry/types/metrics';
import {browserHistory} from 'sentry/utils/browserHistory';
import {getFormattedMQL} from 'sentry/utils/metrics';
import {useApiQuery} from 'sentry/utils/queryClient';
import {decodeInteger, decodeList, decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

import {type Field, FIELDS, SORTS} from './data';
import {
  ProjectRenderer,
  SpanBreakdownSliceRenderer,
  SpanIdRenderer,
  SpanTimeRenderer,
  TraceBreakdownContainer,
  TraceBreakdownRenderer,
  TraceIdRenderer,
  TraceIssuesRenderer,
} from './fieldRenderers';
import {TracesSearchBar} from './tracesSearchBar';
import {getSecondaryNameFromSpan, getStylingSliceName, normalizeTraces} from './utils';

const DEFAULT_PER_PAGE = 20;

export function Content() {
  const location = useLocation();

  const queries = useMemo(() => {
    return decodeList(location.query.query);
  }, [location.query.query]);

  const limit = useMemo(() => {
    return decodeInteger(location.query.perPage, DEFAULT_PER_PAGE);
  }, [location.query.perPage]);

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

  const metricsMax = decodeScalar(location.query.metricsMax);
  const metricsMin = decodeScalar(location.query.metricsMin);
  const metricsOp = decodeScalar(location.query.metricsOp);
  const metricsQuery = decodeScalar(location.query.metricsQuery);
  const mri = decodeScalar(location.query.mri);

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

  const hasMetric = metricsOp && mri;

  const traces = useTraces<Field>({
    fields: [
      ...FIELDS,
      ...SORTS.map(field =>
        field.startsWith('-') ? (field.substring(1) as Field) : (field as Field)
      ),
    ],
    limit,
    query: queries,
    sort: SORTS,
    mri: hasMetric ? mri : undefined,
    metricsMax: hasMetric ? metricsMax : undefined,
    metricsMin: hasMetric ? metricsMin : undefined,
    metricsOp: hasMetric ? metricsOp : undefined,
    metricsQuery: hasMetric ? metricsQuery : undefined,
  });

  const isLoading = traces.isFetching;
  const isError = !isLoading && traces.isError;
  const isEmpty = !isLoading && !isError && (traces?.data?.data?.length ?? 0) === 0;
  const data = normalizeTraces(!isLoading && !isError ? traces?.data?.data : undefined);

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
                {getFormattedMQL({mri: mri as MRI, op: metricsOp, query: metricsQuery})}
              </strong>
            ),
          })}
        </StyledAlert>
      )}
      {isError && typeof traces.error?.responseJSON?.detail === 'string' ? (
        <StyledAlert type="error" showIcon>
          {traces.error?.responseJSON?.detail}
        </StyledAlert>
      ) : null}
      <TracesSearchBar
        queries={queries}
        handleSearch={handleSearch}
        handleClearSearch={handleClearSearch}
      />
      <StyledPanel>
        <TracePanelContent>
          <StyledPanelHeader align="left" lightText>
            {t('Trace ID')}
          </StyledPanelHeader>
          <StyledPanelHeader align="left" lightText>
            {t('Trace Root')}
          </StyledPanelHeader>
          <StyledPanelHeader align="right" lightText>
            {t('Total Spans')}
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
              <EmptyStateWarning withIcon />
            </StyledPanelItem>
          )}
          {isEmpty && (
            <StyledPanelItem span={7} overflow>
              <EmptyStateWarning withIcon>
                <div>{t('No traces available')}</div>
              </EmptyStateWarning>
            </StyledPanelItem>
          )}
          {data?.map(trace => <TraceRow key={trace.trace} trace={trace} />)}
        </TracePanelContent>
      </StyledPanel>
    </LayoutMain>
  );
}

function TraceRow({trace}: {trace: TraceResult<Field>}) {
  const [expanded, setExpanded] = useState<boolean>(false);
  const [highlightedSliceName, _setHighlightedSliceName] = useState('');

  const setHighlightedSliceName = useMemo(
    () =>
      debounce(sliceName => _setHighlightedSliceName(sliceName), 100, {
        leading: true,
      }),
    [_setHighlightedSliceName]
  );

  const onClickExpand = useCallback(() => setExpanded(e => !e), [setExpanded]);

  return (
    <Fragment>
      <StyledPanelItem align="center" center onClick={onClickExpand}>
        <Button
          icon={<IconChevron size="xs" direction={expanded ? 'down' : 'right'} />}
          aria-label={t('Toggle trace details')}
          aria-expanded={expanded}
          size="zero"
          borderless
        />
        <TraceIdRenderer traceId={trace.trace} timestamp={trace.spans[0].timestamp} />
      </StyledPanelItem>
      <StyledPanelItem align="left" overflow onClick={onClickExpand}>
        <Description>
          {trace.project ? (
            <ProjectRenderer projectSlug={trace.project} hideName />
          ) : null}
          {trace.name ? (
            trace.name
          ) : (
            <EmptyValueContainer>{t('Missing Trace Root')}</EmptyValueContainer>
          )}
        </Description>
      </StyledPanelItem>
      <StyledPanelItem align="right">
        <Count value={trace.numSpans} />
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
        <TraceIssuesRenderer trace={trace} />
      </StyledPanelItem>
      {expanded && (
        <SpanTable
          spans={trace.spans}
          trace={trace}
          setHighlightedSliceName={setHighlightedSliceName}
        />
      )}
    </Fragment>
  );
}

function SpanTable({
  spans,
  trace,
  setHighlightedSliceName,
}: {
  setHighlightedSliceName: (sliceName: string) => void;
  spans: SpanResult<Field>[];
  trace: TraceResult<Field>;
}) {
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
          {spans.map(span => (
            <SpanRow
              key={span.id}
              span={span}
              trace={trace}
              setHighlightedSliceName={setHighlightedSliceName}
            />
          ))}
        </SpanPanelContent>
      </StyledPanel>
    </SpanTablePanelItem>
  );
}

function SpanRow({
  span,
  trace,
  setHighlightedSliceName,
}: {
  setHighlightedSliceName: (sliceName: string) => void;
  span: SpanResult<Field>;

  trace: TraceResult<Field>;
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
        />
      </StyledSpanPanelItem>
      <StyledSpanPanelItem align="left" overflow>
        <Description>
          <ProjectRenderer projectSlug={span.project} hideName />
          <strong>{span['span.op']}</strong>
          <em>{'\u2014'}</em>
          {span['span.description']}
        </Description>
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

export type SpanResult<F extends string> = Record<F, any>;

export interface TraceResult<F extends string> {
  breakdowns: TraceBreakdownResult[];
  duration: number;
  end: number;
  name: string | null;
  numErrors: number;
  numOccurrences: number;
  numSpans: number;
  project: string | null;
  spans: SpanResult<F>[];
  start: number;
  trace: string;
}

interface TraceBreakdownBase {
  duration: number; // Contains the accurate duration for display. Start and end may be quantized.
  end: number;
  opCategory: string | null;
  sdkName: string | null;
  start: number;
}

type TraceBreakdownProject = TraceBreakdownBase & {
  kind: 'project';
  project: string;
};

type TraceBreakdownMissing = TraceBreakdownBase & {
  kind: 'missing';
  project: null;
};

export type TraceBreakdownResult = TraceBreakdownProject | TraceBreakdownMissing;

interface TraceResults<F extends string> {
  data: TraceResult<F>[];
  meta: any;
}

interface UseTracesOptions<F extends string> {
  fields: F[];
  datetime?: PageFilters['datetime'];
  enabled?: boolean;
  limit?: number;
  metricsMax?: string;
  metricsMin?: string;
  metricsOp?: string;
  metricsQuery?: string;
  mri?: string;
  query?: string | string[];
  sort?: string[];
  suggestedQuery?: string;
}

function useTraces<F extends string>({
  fields,
  datetime,
  enabled,
  limit,
  mri,
  metricsMax,
  metricsMin,
  metricsOp,
  metricsQuery,
  query,
  suggestedQuery,
  sort,
}: UseTracesOptions<F>) {
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const path = `/organizations/${organization.slug}/traces/`;

  const endpointOptions = {
    query: {
      project: selection.projects,
      environment: selection.environments,
      ...(datetime ?? normalizeDateTimeParams(selection.datetime)),
      field: fields,
      query,
      suggestedQuery,
      sort,
      per_page: limit,
      breakdownSlices: 40,
      minBreakdownPercentage: 1 / 40,
      maxSpansPerTrace: 5,
      mri,
      metricsMax,
      metricsMin,
      metricsOp,
      metricsQuery,
    },
  };

  return useApiQuery<TraceResults<F>>([path, endpointOptions], {
    staleTime: 0,
    refetchOnWindowFocus: false,
    retry: false,
    enabled,
  });
}

const LayoutMain = styled(Layout.Main)`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
`;

const StyledPanel = styled(Panel)`
  margin-bottom: 0px;
`;

const TracePanelContent = styled('div')`
  width: 100%;
  display: grid;
  grid-template-columns: repeat(1, min-content) auto repeat(2, min-content) 85px 85px 66px;
`;

const SpanPanelContent = styled('div')`
  width: 100%;
  display: grid;
  grid-template-columns: repeat(1, min-content) auto repeat(1, min-content) 141px 85px;
`;

const StyledPanelHeader = styled(PanelHeader)<{align: 'left' | 'right'}>`
  white-space: nowrap;
  justify-content: ${p => (p.align === 'left' ? 'flex-start' : 'flex-end')};
`;

const Description = styled('div')`
  ${p => p.theme.overflowEllipsis};
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: ${space(1)};
`;

const StyledPanelItem = styled(PanelItem)<{
  align?: 'left' | 'center' | 'right';
  overflow?: boolean;
  span?: number;
}>`
  align-items: center;
  padding: ${space(1)} ${space(2)};
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
  ${p => p.span && `grid-column: auto / span ${p.span}`}
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
