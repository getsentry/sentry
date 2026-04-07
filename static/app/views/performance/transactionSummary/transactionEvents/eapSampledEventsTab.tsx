import {useMemo} from 'react';
import type {Location} from 'history';
import omit from 'lodash/omit';

import {LinkButton} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Grid} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/pageFilters/date/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/pageFilters/environment/environmentPageFilter';
import {PageFilterBar} from 'sentry/components/pageFilters/pageFilterBar';
import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import type {CursorHandler} from 'sentry/components/pagination';
import {useSpanSearchQueryBuilderProps} from 'sentry/components/performance/spanSearchQueryBuilder';
import {t} from 'sentry/locale';
import {DataCategory, type PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {encodeSort, type EventView} from 'sentry/utils/discover/eventView';
import {removeHistogramQueryStrings} from 'sentry/utils/performance/histogram';
import {decodeScalar, decodeSorts} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useDatePageFilterProps} from 'sentry/utils/useDatePageFilterProps';
import {useLocation} from 'sentry/utils/useLocation';
import {useMaxPickableDays} from 'sentry/utils/useMaxPickableDays';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useProjects} from 'sentry/utils/useProjects';
import {TraceItemSearchQueryBuilder} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {getExploreUrl} from 'sentry/views/explore/utils';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {QueryParameterNames} from 'sentry/views/insights/common/views/queryParameters';
import {SEGMENT_SPANS_CURSOR} from 'sentry/views/performance/eap/utils';
import {
  decodeFilterFromLocation,
  SpanOperationBreakdownFilter,
} from 'sentry/views/performance/transactionSummary/filter';
import {SampledEventsTable} from 'sentry/views/performance/transactionSummary/transactionEvents/eapSampledEventsTable';
import {
  ZOOM_END,
  ZOOM_START,
} from 'sentry/views/performance/transactionSummary/transactionOverview/latencyChart/utils';
import {useTransactionSummaryContext} from 'sentry/views/performance/transactionSummary/transactionSummaryContext';
import {
  platformToPerformanceType,
  ProjectPerformanceType,
} from 'sentry/views/performance/utils';

import {
  decodeEventsDisplayFilterFromLocation,
  EventsDisplayFilterName,
  getEventsFilterOptions,
  type PercentileValues,
} from './utils';

export function EAPSampledEventsTab() {
  const {organization, eventView, transactionName} = useTransactionSummaryContext();
  const navigate = useNavigate();
  const location = useLocation();
  const {selection} = usePageFilters();

  const eventsDisplayFilterName = decodeEventsDisplayFilterFromLocation(location);
  const {maxDuration, isLoading: isMaxDurationLoading} = useMaxDuration(
    transactionName,
    selection,
    eventsDisplayFilterName
  );

  const spanOperationBreakdownFilter = decodeFilterFromLocation(location);

  const cursor = decodeScalar(location.query?.[SEGMENT_SPANS_CURSOR]);
  const onCursor: CursorHandler = (newCursor, pathname, query) => {
    navigate({
      pathname,
      query: {...query, [SEGMENT_SPANS_CURSOR]: newCursor},
    });
  };

  const onChangeEventsDisplayFilter = (newFilterName: EventsDisplayFilterName) => {
    trackAnalytics(
      'performance_views.transactionEvents.display_filter_dropdown.selection',
      {
        organization,
        action: newFilterName as string,
      }
    );

    const nextQuery: Location['query'] = {
      ...removeHistogramQueryStrings(location, [ZOOM_START, ZOOM_END]),
      ...filterEventsDisplayToEAPLocationQuery(newFilterName),
      [SEGMENT_SPANS_CURSOR]: undefined,
    };

    if (newFilterName === EventsDisplayFilterName.P100) {
      delete nextQuery.showTransactions;
    }

    navigate({
      pathname: location.pathname,
      query: nextQuery,
    });
  };

  return (
    <Layout.Main width="full">
      <FilterBar
        eventView={eventView}
        location={location}
        spanOperationBreakdownFilter={spanOperationBreakdownFilter}
        eventsDisplayFilterName={eventsDisplayFilterName}
        onChangeEventsDisplayFilter={onChangeEventsDisplayFilter}
        maxDuration={maxDuration}
        organization={organization}
        transactionName={transactionName}
      />
      <SampledEventsTable
        eventView={eventView}
        transactionName={transactionName}
        maxDuration={maxDuration}
        isMaxDurationLoading={isMaxDurationLoading}
        cursor={cursor}
        onCursor={onCursor}
      />
    </Layout.Main>
  );
}

type FilterBarProps = {
  eventView: EventView;
  eventsDisplayFilterName: EventsDisplayFilterName;
  location: Location;
  onChangeEventsDisplayFilter: (eventsDisplayFilterName: EventsDisplayFilterName) => void;
  organization: Organization;
  spanOperationBreakdownFilter: SpanOperationBreakdownFilter;
  transactionName: string;
  maxDuration?: number;
};

function FilterBar(props: FilterBarProps) {
  const {eventView, location} = props;

  const navigate = useNavigate();

  const handleSearch = (query: string) => {
    const queryParams = normalizeDateTimeParams({
      ...location.query,
      query,
    });

    // do not propagate pagination when making a new search
    const searchQueryParams = omit(queryParams, SEGMENT_SPANS_CURSOR);

    navigate({
      pathname: location.pathname,
      query: searchQueryParams,
    });
  };

  const query = decodeScalar(location.query.query, '');

  const projectIds = useMemo(() => eventView.project?.slice(), [eventView.project]);

  const maxPickableDays = useMaxPickableDays({
    dataCategories: [DataCategory.SPANS],
  });
  const datePageFilterProps = useDatePageFilterProps(maxPickableDays);

  return (
    <Grid gap="xl" marginBottom="xl" columns={{sm: 'auto 1fr auto auto'}}>
      <PageFilterBar condensed>
        <EnvironmentPageFilter />
        <DatePageFilter {...datePageFilterProps} />
      </PageFilterBar>
      <SearchBar
        projects={projectIds ?? []}
        initialQuery={query}
        onSearch={handleSearch}
      />
      <PercentileSelect {...props} />
      <OpenInExploreButton {...props} />
    </Grid>
  );
}

function SearchBar({
  projects,
  initialQuery,
  onSearch,
}: {
  initialQuery: string;
  onSearch: (query: string) => void;
  projects: number[];
}) {
  const {spanSearchQueryBuilderProps} = useSpanSearchQueryBuilderProps({
    projects,
    initialQuery,
    onSearch,
    searchSource: 'sampled_events',
  });

  return (
    <TraceItemSearchQueryBuilder {...spanSearchQueryBuilderProps} disallowFreeText />
  );
}

function PercentileSelect({
  eventsDisplayFilterName,
  onChangeEventsDisplayFilter,
  spanOperationBreakdownFilter,
}: {
  eventsDisplayFilterName: EventsDisplayFilterName;
  onChangeEventsDisplayFilter: (eventsDisplayFilterName: EventsDisplayFilterName) => void;
  spanOperationBreakdownFilter: SpanOperationBreakdownFilter;
}) {
  const eventsFilterOptions = getEventsFilterOptions(spanOperationBreakdownFilter);
  return (
    <CompactSelect
      trigger={triggerProps => (
        <OverlayTrigger.Button {...triggerProps} prefix={t('Percentile')} />
      )}
      value={eventsDisplayFilterName}
      onChange={opt => onChangeEventsDisplayFilter(opt.value)}
      options={Object.entries(eventsFilterOptions).map(([name, filter]) => ({
        value: name as EventsDisplayFilterName,
        label: filter.label,
      }))}
    />
  );
}

function OpenInExploreButton({
  location,
  organization,
  transactionName,
  maxDuration,
  eventView,
}: {
  eventView: EventView;
  location: Location;
  organization: Organization;
  transactionName: string;
  maxDuration?: number;
}) {
  const {projects} = useProjects();
  const {selection} = usePageFilters();

  if (!organization.features.includes('visibility-explore-view')) {
    return null;
  }

  const rawQuery = decodeScalar(location.query.query, '');
  const query = new MutableSearch(rawQuery);
  query.setFilterValues('is_transaction', ['true']);
  query.setFilterValues('transaction', [transactionName]);
  if (maxDuration !== undefined && maxDuration > 0) {
    query.setFilterValues('span.duration', [`<=${maxDuration.toFixed(0)}`]);
  }

  const sort = decodeSorts(location.query?.[QueryParameterNames.SPANS_SORT])[0] ?? {
    field: 'timestamp',
    kind: 'desc' as const,
  };

  const field = ['span_id', 'span.duration', 'trace', 'timestamp'];
  const isBackend =
    platformToPerformanceType(projects, eventView.project) ===
    ProjectPerformanceType.BACKEND;
  if (isBackend) {
    field.splice(1, 0, 'request.method');
  }

  const exploreUrl = getExploreUrl({
    organization,
    selection,
    mode: Mode.SAMPLES,
    query: query.formatString(),
    field,
    sort: encodeSort(sort),
  });

  return <LinkButton to={exploreUrl}>{t('Open in Explore')}</LinkButton>;
}

function useMaxDuration(
  transactionName: string,
  pageFilters: PageFilters,
  eventsDisplayFilterName: EventsDisplayFilterName
) {
  const hasDurationFilter = eventsDisplayFilterName !== EventsDisplayFilterName.P100;

  const search = new MutableSearch('');
  search.setFilterValues('is_transaction', ['true']);
  search.setFilterValues('transaction', [transactionName]);

  const {data, isLoading} = useSpans(
    {
      search,
      pageFilters,
      fields: [...EAP_PERCENTILE_FIELDS],
      enabled: hasDurationFilter,
    },
    'api.insights.transaction-events-percentiles'
  );

  const percentileValues = mapEAPPercentileValues(data);
  const maxDuration = hasDurationFilter
    ? percentileValues?.[eventsDisplayFilterName]
    : undefined;
  return {maxDuration, isLoading};
}

const EAP_PERCENTILE_FIELDS = [
  'p50(span.duration)',
  'p75(span.duration)',
  'p95(span.duration)',
  'p99(span.duration)',
  'p100(span.duration)',
] as const;

function mapEAPPercentileValues(data: Array<Record<string, number>>): PercentileValues {
  const row = data[0];
  return {
    p50: row?.['p50(span.duration)'] ?? 0,
    p75: row?.['p75(span.duration)'] ?? 0,
    p95: row?.['p95(span.duration)'] ?? 0,
    p99: row?.['p99(span.duration)'] ?? 0,
    p100: row?.['p100(span.duration)'] ?? 0,
  };
}

function filterEventsDisplayToEAPLocationQuery(option: EventsDisplayFilterName) {
  const query: Record<string, string> = {
    showTransactions: option,
  };
  if (option !== EventsDisplayFilterName.P100) {
    query[QueryParameterNames.SPANS_SORT] = '-span.duration';
  }
  return query;
}
