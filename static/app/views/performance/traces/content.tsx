import {Fragment, useCallback, useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';

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
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {PageFilters} from 'sentry/types/core';
import {browserHistory} from 'sentry/utils/browserHistory';
import {useApiQuery} from 'sentry/utils/queryClient';
import {decodeInteger, decodeList} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

import {type Field, FIELDS, SORTS} from './data';
import {
  ProjectRenderer,
  SpanBreakdownSliceRenderer,
  SpanIdRenderer,
  TraceBreakdownContainer,
  TraceBreakdownRenderer,
  TraceIdRenderer,
  TraceIssuesRenderer,
} from './fieldRenderers';
import {TracesSearchBar} from './tracesSearchBar';
import {normalizeTraces} from './utils';

const DEFAULT_PER_PAGE = 20;

export function Content() {
  const location = useLocation();

  const queries = useMemo(() => {
    return decodeList(location.query.query);
  }, [location.query.query]);

  const limit = useMemo(() => {
    return decodeInteger(location.query.perPage, DEFAULT_PER_PAGE);
  }, [location.query.perPage]);

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
      <TracesSearchBar
        queries={queries}
        handleSearch={handleSearch}
        handleClearSearch={handleClearSearch}
      />
      <StyledPanel>
        <TracePanelContent>
          <StyledPanelHeader align="right" lightText>
            {t('Trace ID')}
          </StyledPanelHeader>
          <StyledPanelHeader align="left" lightText>
            {t('Trace Root')}
          </StyledPanelHeader>
          <StyledPanelHeader align="right" lightText>
            {t('Total Spans')}
          </StyledPanelHeader>
          <StyledPanelHeader align="right" lightText>
            {t('Breakdown')}
          </StyledPanelHeader>
          <StyledPanelHeader align="right" lightText>
            {t('Trace Duration')}
          </StyledPanelHeader>
          <StyledPanelHeader align="right" lightText>
            {t('Issues')}
          </StyledPanelHeader>
          <StyledPanelHeader align="right" lightText style={{padding: '5px'}} />
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
              <EmptyStateWarning withIcon />
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
  return (
    <Fragment>
      <StyledPanelItem align="center" center>
        <Button
          icon={<IconChevron size="xs" direction={expanded ? 'down' : 'right'} />}
          aria-label={t('Toggle trace details')}
          aria-expanded={expanded}
          size="zero"
          borderless
          onClick={() => setExpanded(e => !e)}
        />
        <TraceIdRenderer traceId={trace.trace} timestamp={trace.spans[0].timestamp} />
      </StyledPanelItem>
      <StyledPanelItem align="left" overflow>
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
        <TraceIssuesRenderer trace={trace} />
      </StyledPanelItem>
      <StyledPanelItem style={{padding: '5px'}} />
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
            {t('Issues')}
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
            sliceStart={Math.ceil(span['precise.start_ts'] * 1000)}
            sliceEnd={Math.floor(span['precise.finish_ts'] * 1000)}
            trace={trace}
            theme={theme}
            onMouseEnter={() => setHighlightedSliceName(span.project)}
          />
        </TraceBreakdownContainer>
      </StyledSpanPanelItem>
      <StyledSpanPanelItem align="right">
        <PerformanceDuration milliseconds={span['span.duration']} abbreviation />
      </StyledSpanPanelItem>
      <StyledSpanPanelItem align="right">
        <EmptyValueContainer>{'\u2014'}</EmptyValueContainer>
      </StyledSpanPanelItem>
    </Fragment>
  );
}

type SpanResult<F extends string> = Record<F, any>;

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
  end: number;
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
  query?: string | string[];
  sort?: string[];
  suggestedQuery?: string;
}

function useTraces<F extends string>({
  fields,
  datetime,
  enabled,
  limit,
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
      maxSpansPerTrace: 10,
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
  grid-template-columns: repeat(1, min-content) auto repeat(2, min-content) 120px 66px 10px;
`;

const SpanPanelContent = styled('div')`
  width: 100%;
  display: grid;
  grid-template-columns: repeat(1, min-content) auto repeat(1, min-content) 120px 66px;
`;

const StyledPanelHeader = styled(PanelHeader)<{align: 'left' | 'right'}>`
  white-space: nowrap;
  justify-content: ${p => (p.align === 'left' ? 'flex-start' : 'flex-end')};
  padding: ${space(2)} ${space(1)};
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
  padding: ${space(1)};
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
         --highlightedSlice-${p.highlightedSliceName}-transform: translateY(-1px);
       `
      : null}
  ${p =>
    p.highlightedSliceName
      ? `
        --defaultSlice-opacity: 0.3;
        --defaultSlice-transform: translateY(1px);
        `
      : `
        --defaultSlice-opacity: 1.0;
        --defaultSlice-transform: translateY(0px);
        `}
`;

const EmptyValueContainer = styled('span')`
  color: ${p => p.theme.gray300};
`;
