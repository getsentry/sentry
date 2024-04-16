import {Fragment, useCallback, useMemo, useState} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';

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
import type {SmartSearchBarProps} from 'sentry/components/smartSearchBar';
import {IconChevron} from 'sentry/icons/iconChevron';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {PageFilters} from 'sentry/types';
import {useApiQuery} from 'sentry/utils/queryClient';
import {decodeInteger, decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

import {ProjectRenderer, SpanIdRenderer, TraceIdRenderer} from './fieldRenderers';
import {TracesSearchBar} from './tracesSearchBar';

const DEFAULT_PER_PAGE = 20;

const FIELDS = [
  'project',
  'transaction.id',
  'id',
  'timestamp',
  'span.op',
  'span.description',
  'span.duration',
];
type Field = (typeof FIELDS)[number];

export function Content() {
  const location = useLocation();

  const query = useMemo(() => {
    return decodeScalar(location.query.query, '');
  }, [location.query.query]);

  const limit = useMemo(() => {
    return decodeInteger(location.query.perPage, DEFAULT_PER_PAGE);
  }, [location.query.perPage]);

  const handleSearch: SmartSearchBarProps['onSearch'] = useCallback(
    (searchQuery: string) => {
      browserHistory.push({
        ...location,
        query: {
          ...location.query,
          cursor: undefined,
          query: searchQuery || undefined,
        },
      });
    },
    [location]
  );

  const traces = useTraces<Field>({
    fields: FIELDS,
    limit,
    query,
  });

  const isLoading = traces.isFetching;
  const isError = !isLoading && traces.isError;
  const isEmpty = !isLoading && !isError && (traces?.data?.data?.length ?? 0) === 0;
  const data = !isLoading && !isError ? traces?.data?.data : undefined;

  return (
    <LayoutMain fullWidth>
      <PageFilterBar condensed>
        <ProjectPageFilter />
        <EnvironmentPageFilter />
        <DatePageFilter />
      </PageFilterBar>
      <TracesSearchBar query={query} handleSearch={handleSearch} />
      <StyledPanel>
        <TracePanelContent>
          <StyledPanelHeader align="right" lightText>
            {t('Trace ID')}
          </StyledPanelHeader>
          <StyledPanelHeader align="left" lightText>
            {t('Trace Root Name')}
          </StyledPanelHeader>
          <StyledPanelHeader align="right" lightText>
            {t('Spans')}
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
          {isLoading && (
            <StyledPanelItem span={6}>
              <LoadingIndicator />
            </StyledPanelItem>
          )}
          {isError && ( // TODO: need an error state
            <StyledPanelItem span={6}>
              <EmptyStateWarning withIcon />
            </StyledPanelItem>
          )}
          {isEmpty && (
            <StyledPanelItem span={6}>
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
      <StyledPanelItem align="left">
        {trace.name ? (
          trace.name
        ) : (
          <EmptyValueContainer>{t('No Name Available')}</EmptyValueContainer>
        )}
      </StyledPanelItem>
      <StyledPanelItem align="right">
        <Count value={trace.numSpans} />
      </StyledPanelItem>
      <StyledPanelItem align="right">
        <EmptyValueContainer>{'\u2014'}</EmptyValueContainer>
      </StyledPanelItem>
      <StyledPanelItem align="right">
        <PerformanceDuration milliseconds={trace.duration} abbreviation />
      </StyledPanelItem>
      <StyledPanelItem align="right">
        <EmptyValueContainer>{'\u2014'}</EmptyValueContainer>
      </StyledPanelItem>
      {expanded && (
        <StyledPanelItem span={6}>
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
              {trace.spans.map(span => (
                <SpanRow key={span.id} span={span} trace={trace.trace} />
              ))}
            </SpanPanelContent>
          </StyledPanel>
        </StyledPanelItem>
      )}
    </Fragment>
  );
}

function SpanRow({span, trace}: {span: SpanResult<Field>; trace: string}) {
  return (
    <Fragment>
      <StyledPanelItem align="right">
        <SpanIdRenderer
          projectSlug={span.project}
          transactionId={span['transaction.id']}
          spanId={span.id}
          trace={trace}
          timestamp={span.timestamp}
        />
      </StyledPanelItem>
      <StyledPanelItem align="left">
        <Description>
          <ProjectRenderer projectSlug={span.project} hideName />
          <strong>{span['span.op']}</strong>
          <em>{'\u2014'}</em>
          {span['span.description']}
        </Description>
      </StyledPanelItem>
      <StyledPanelItem align="right">
        <EmptyValueContainer>{'\u2014'}</EmptyValueContainer>
      </StyledPanelItem>
      <StyledPanelItem align="right">
        <PerformanceDuration milliseconds={span['span.duration']} abbreviation />
      </StyledPanelItem>
      <StyledPanelItem align="right">
        <EmptyValueContainer>{'\u2014'}</EmptyValueContainer>
      </StyledPanelItem>
    </Fragment>
  );
}

type SpanResult<F extends string> = Record<F, any>;

interface TraceResult<F extends string> {
  duration: number;
  name: string | null;
  numSpans: number;
  spans: SpanResult<F>[];
  trace: string;
}

interface TraceResults<F extends string> {
  data: TraceResult<F>[];
  meta: any;
}

interface UseTracesOptions<F extends string> {
  fields: F[];
  datetime?: PageFilters['datetime'];
  enabled?: boolean;
  limit?: number;
  query?: string;
}

function useTraces<F extends string>({
  fields,
  datetime,
  enabled,
  limit,
  query,
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
  grid-template-columns: repeat(1, min-content) auto repeat(4, min-content);
`;

const SpanPanelContent = styled('div')`
  width: 100%;
  display: grid;
  grid-template-columns: repeat(1, min-content) auto repeat(3, min-content);
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
  span?: number;
}>`
  padding: ${space(1)};
  ${p => p.theme.overflowEllipsis};
  ${p =>
    p.align === 'center'
      ? `
  justify-content: space-around;`
      : p.align === 'left' || p.align === 'right'
        ? `text-align: ${p.align};`
        : undefined}
  ${p => p.span && `grid-column: auto / span ${p.span}`}
`;

const EmptyValueContainer = styled('span')`
  color: ${p => p.theme.gray300};
`;
