import {Fragment} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';
import omit from 'lodash/omit';

import Feature from 'sentry/components/acl/feature';
import type {DropdownOption} from 'sentry/components/discover/transactionsList';
import TransactionsList from 'sentry/components/discover/transactionsList';
import SearchBar from 'sentry/components/events/searchBar';
import {
  STATIC_FIELD_TAGS_WITHOUT_ERROR_FIELDS,
  STATIC_SPAN_TAGS,
} from 'sentry/components/events/searchBarFieldConstants';
import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {SuspectFunctionsTable} from 'sentry/components/profiling/suspectFunctions/suspectFunctionsTable';
import {SearchQueryBuilder} from 'sentry/components/searchQueryBuilder';
import type {FilterKeySection} from 'sentry/components/searchQueryBuilder/types';
import type {ActionBarItem} from 'sentry/components/smartSearchBar';
import {Tooltip} from 'sentry/components/tooltip';
import {MAX_QUERY_LENGTH} from 'sentry/constants';
import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {TagCollection} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {defined, generateQueryWithTag} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {browserHistory} from 'sentry/utils/browserHistory';
import type EventView from 'sentry/utils/discover/eventView';
import {
  formatTagKey,
  isRelativeSpanOperationBreakdownField,
  SPAN_OP_BREAKDOWN_FIELDS,
  SPAN_OP_RELATIVE_BREAKDOWN_FIELD,
} from 'sentry/utils/discover/fields';
import type {QueryError} from 'sentry/utils/discover/genericDiscoverQuery';
import {FieldKey} from 'sentry/utils/fields';
import type {MetricsEnhancedPerformanceDataContext} from 'sentry/utils/performance/contexts/metricsEnhancedPerformanceDataContext';
import {useMEPDataContext} from 'sentry/utils/performance/contexts/metricsEnhancedPerformanceDataContext';
import {decodeScalar} from 'sentry/utils/queryString';
import projectSupportsReplay from 'sentry/utils/replays/projectSupportsReplay';
import {useRoutes} from 'sentry/utils/useRoutes';
import withProjects from 'sentry/utils/withProjects';
import type {Actions} from 'sentry/views/discover/table/cellAction';
import {updateQuery} from 'sentry/views/discover/table/cellAction';
import type {TableColumn} from 'sentry/views/discover/table/types';
import Tags from 'sentry/views/discover/tags';
import {canUseTransactionMetricsData} from 'sentry/views/performance/transactionSummary/transactionOverview/utils';
import {
  PERCENTILE as VITAL_PERCENTILE,
  VITAL_GROUPS,
} from 'sentry/views/performance/transactionSummary/transactionVitals/constants';

import {isSummaryViewFrontend, isSummaryViewFrontendPageLoad} from '../../utils';
import Filter, {
  decodeFilterFromLocation,
  filterToField,
  filterToSearchConditions,
  SpanOperationBreakdownFilter,
} from '../filter';
import {
  generateProfileLink,
  generateReplayLink,
  generateTraceLink,
  generateTransactionIdLink,
  normalizeSearchConditions,
  SidebarSpacer,
  TransactionFilterOptions,
} from '../utils';

import TransactionSummaryCharts from './charts';
import {PerformanceAtScaleContextProvider} from './performanceAtScaleContext';
import RelatedIssues from './relatedIssues';
import SidebarCharts from './sidebarCharts';
import StatusBreakdown from './statusBreakdown';
import SuspectSpans from './suspectSpans';
import {TagExplorer} from './tagExplorer';
import UserStats from './userStats';

// TODO: We may want to reuse these filter key sections for other searchbars in the future, when we upgrade to SearchQueryBuilder in multiple pages.
// Refactor and move this constant accordingly when that happens
const FITLER_KEY_SECTIONS: FilterKeySection[] = [
  {
    value: 'transaction_fields',
    label: 'Transaction',
    children: [
      FieldKey.TRANSACTION_DURATION,
      FieldKey.TRANSACTION_OP,
      FieldKey.TRANSACTION_STATUS,
    ],
  },
  {
    value: 'user_identification_fields',
    label: 'User Identification',
    children: [
      FieldKey.USER,
      FieldKey.USER_DISPLAY,
      FieldKey.USER_EMAIL,
      FieldKey.USER_ID,
      FieldKey.USER_IP,
      FieldKey.USER_USERNAME,
    ],
  },
  {
    value: 'http_fields',
    label: 'HTTP',
    children: [
      FieldKey.HTTP_METHOD,
      FieldKey.HTTP_REFERER,
      FieldKey.HTTP_STATUS_CODE,
      FieldKey.HTTP_URL,
    ],
  },
  {
    value: 'span_duration_fields',
    label: 'Span Duration',
    children: SPAN_OP_BREAKDOWN_FIELDS,
  },
  // TODO: In the future, it would be awesome if we could be more 'smart' about which fields we expose here.
  // For example, these device fields are likely not necessary for a Python transaction, but they should be suggested for mobile
  {
    value: 'device_fields',
    label: 'Device',
    children: [
      FieldKey.DEVICE_ARCH,
      FieldKey.DEVICE_BATTERY_LEVEL,
      FieldKey.DEVICE_BRAND,
      FieldKey.DEVICE_CHARGING,
      FieldKey.DEVICE_CLASS,
      FieldKey.DEVICE_FAMILY,
      FieldKey.DEVICE_LOCALE,
      FieldKey.DEVICE_MODEL_ID,
      FieldKey.DEVICE_NAME,
      FieldKey.DEVICE_ONLINE,
      FieldKey.DEVICE_ORIENTATION,
      FieldKey.DEVICE_SCREEN_DENSITY,
      FieldKey.DEVICE_SCREEN_DPI,
      FieldKey.DEVICE_SCREEN_HEIGHT_PIXELS,
      FieldKey.DEVICE_SCREEN_WIDTH_PIXELS,
      FieldKey.DEVICE_SIMULATOR,
      FieldKey.DEVICE_UUID,
    ],
  },
];

type Props = {
  error: QueryError | null;
  eventView: EventView;
  isLoading: boolean;
  location: Location;
  onChangeFilter: (newFilter: SpanOperationBreakdownFilter) => void;
  organization: Organization;
  projectId: string;
  projects: Project[];
  spanOperationBreakdownFilter: SpanOperationBreakdownFilter;
  totalValues: Record<string, number> | null;
  transactionName: string;
};

function SummaryContent({
  eventView,
  location,
  totalValues,
  spanOperationBreakdownFilter,
  organization,
  projects,
  isLoading,
  error,
  projectId,
  transactionName,
  onChangeFilter,
}: Props) {
  const routes = useRoutes();
  const mepDataContext = useMEPDataContext();

  function handleSearch(query: string) {
    const queryParams = normalizeDateTimeParams({
      ...(location.query || {}),
      query,
    });

    // do not propagate pagination when making a new search
    const searchQueryParams = omit(queryParams, 'cursor');

    browserHistory.push({
      pathname: location.pathname,
      query: searchQueryParams,
    });
  }

  function generateTagUrl(key: string, value: string) {
    const query = generateQueryWithTag(location.query, {key: formatTagKey(key), value});

    return {
      ...location,
      query,
    };
  }

  function handleCellAction(column: TableColumn<React.ReactText>) {
    return (action: Actions, value: React.ReactText) => {
      const searchConditions = normalizeSearchConditions(eventView.query);

      updateQuery(searchConditions, action, column, value);

      browserHistory.push({
        pathname: location.pathname,
        query: {
          ...location.query,
          cursor: undefined,
          query: searchConditions.formatString(),
        },
      });
    };
  }

  function handleTransactionsListSortChange(value: string) {
    const target = {
      pathname: location.pathname,
      query: {...location.query, showTransactions: value, transactionCursor: undefined},
    };

    browserHistory.push(target);
  }

  function handleAllEventsViewClick() {
    trackAnalytics('performance_views.summary.view_in_transaction_events', {
      organization,
    });
  }

  function generateEventView(
    transactionsListEventView: EventView,
    transactionsListTitles: string[]
  ) {
    const {selected} = getTransactionsListSort(location, {
      p95: totalValues?.['p95()'] ?? 0,
      spanOperationBreakdownFilter,
    });
    const sortedEventView = transactionsListEventView.withSorts([selected.sort]);

    if (spanOperationBreakdownFilter === SpanOperationBreakdownFilter.NONE) {
      const fields = [
        // Remove the extra field columns
        ...sortedEventView.fields.slice(0, transactionsListTitles.length),
      ];

      // omit "Operation Duration" column
      sortedEventView.fields = fields.filter(({field}) => {
        return !isRelativeSpanOperationBreakdownField(field);
      });
    }
    return sortedEventView;
  }

  function generateActionBarItems(
    _org: Organization,
    _location: Location,
    _mepDataContext: MetricsEnhancedPerformanceDataContext
  ) {
    let items: ActionBarItem[] | undefined = undefined;
    if (!canUseTransactionMetricsData(_org, _mepDataContext)) {
      items = [
        {
          key: 'alert',
          makeAction: () => ({
            Button: () => (
              <Tooltip
                title={t(
                  'Based on your search criteria and sample rate, the events available may be limited.'
                )}
              >
                <StyledIconWarning
                  data-test-id="search-metrics-fallback-warning"
                  size="sm"
                  color="warningText"
                />
              </Tooltip>
            ),
            menuItem: {
              key: 'alert',
            },
          }),
        },
      ];
    }

    return items;
  }

  const hasPerformanceChartInterpolation = organization.features.includes(
    'performance-chart-interpolation'
  );

  const query = decodeScalar(location.query.query, '');
  const totalCount = totalValues === null ? null : totalValues['count()'];

  // NOTE: This is not a robust check for whether or not a transaction is a front end
  // transaction, however it will suffice for now.
  const hasWebVitals =
    isSummaryViewFrontendPageLoad(eventView, projects) ||
    (totalValues !== null &&
      VITAL_GROUPS.some(group =>
        group.vitals.some(vital => {
          const functionName = `percentile(${vital},${VITAL_PERCENTILE})`;
          const field = functionName;
          return Number.isFinite(totalValues[field]) && totalValues[field] !== 0;
        })
      ));

  const isFrontendView = isSummaryViewFrontend(eventView, projects);

  const transactionsListTitles = [
    t('event id'),
    t('user'),
    t('total duration'),
    t('trace id'),
    t('timestamp'),
  ];

  const project = projects.find(p => p.id === projectId);

  let transactionsListEventView = eventView.clone();
  const fields = [...transactionsListEventView.fields];

  if (
    organization.features.includes('session-replay') &&
    project &&
    projectSupportsReplay(project)
  ) {
    transactionsListTitles.push(t('replay'));
    fields.push({field: 'replayId'});
  }

  if (
    // only show for projects that already sent a profile
    // once we have a more compact design we will show this for
    // projects that support profiling as well
    project?.hasProfiles &&
    (organization.features.includes('profiling') ||
      organization.features.includes('continuous-profiling'))
  ) {
    transactionsListTitles.push(t('profile'));

    if (organization.features.includes('profiling')) {
      fields.push({field: 'profile.id'});
    }

    if (organization.features.includes('continuous-profiling')) {
      fields.push({field: 'profiler.id'});
      fields.push({field: 'thread.id'});
      fields.push({field: 'precise.start_ts'});
      fields.push({field: 'precise.finish_ts'});
    }
  }

  // update search conditions

  const spanOperationBreakdownConditions = filterToSearchConditions(
    spanOperationBreakdownFilter,
    location
  );

  if (spanOperationBreakdownConditions) {
    eventView = eventView.clone();
    eventView.query = `${eventView.query} ${spanOperationBreakdownConditions}`.trim();
    transactionsListEventView = eventView.clone();
  }

  // update header titles of transactions list

  const operationDurationTableTitle =
    spanOperationBreakdownFilter === SpanOperationBreakdownFilter.NONE
      ? t('operation duration')
      : `${spanOperationBreakdownFilter} duration`;

  // add ops breakdown duration column as the 3rd column
  transactionsListTitles.splice(2, 0, operationDurationTableTitle);

  // span_ops_breakdown.relative is a preserved name and a marker for the associated
  // field renderer to be used to generate the relative ops breakdown
  let durationField = SPAN_OP_RELATIVE_BREAKDOWN_FIELD;

  if (spanOperationBreakdownFilter !== SpanOperationBreakdownFilter.NONE) {
    durationField = filterToField(spanOperationBreakdownFilter)!;
  }

  // add ops breakdown duration column as the 3rd column
  fields.splice(2, 0, {field: durationField});

  if (spanOperationBreakdownFilter === SpanOperationBreakdownFilter.NONE) {
    fields.push(
      ...SPAN_OP_BREAKDOWN_FIELDS.map(field => {
        return {field};
      })
    );
  }

  transactionsListEventView.fields = fields;

  const openAllEventsProps = {
    generatePerformanceTransactionEventsView: () => {
      const performanceTransactionEventsView = generateEventView(
        transactionsListEventView,
        transactionsListTitles
      );
      performanceTransactionEventsView.query = query;
      return performanceTransactionEventsView;
    },
    handleOpenAllEventsClick: handleAllEventsViewClick,
  };

  const hasNewSpansUIFlag =
    organization.features.includes('performance-spans-new-ui') &&
    organization.features.includes('insights-initial-modules');

  function renderSearchBar() {
    return (
      <StyledSearchBarWrapper>
        <Feature
          features={'search-query-builder-performance'}
          renderDisabled={() => (
            <SearchBar
              searchSource="transaction_summary"
              organization={organization}
              projectIds={eventView.project}
              query={query}
              fields={eventView.fields}
              onSearch={handleSearch}
              maxQueryLength={MAX_QUERY_LENGTH}
              actionBarItems={generateActionBarItems(
                organization,
                location,
                mepDataContext
              )}
            />
          )}
        >
          <SearchQueryBuilder
            filterKeys={getTransactionFilterTags()}
            initialQuery={query}
            searchSource={'transaction_summary'}
            getTagValues={getTransactionFilterTagValues}
            filterKeySections={FITLER_KEY_SECTIONS}
            disallowFreeText
            disallowUnsupportedFilters
          />
        </Feature>
      </StyledSearchBarWrapper>
    );
  }

  return (
    <Fragment>
      <Layout.Main>
        <FilterActions>
          <Filter
            organization={organization}
            currentFilter={spanOperationBreakdownFilter}
            onChangeFilter={onChangeFilter}
          />
          <PageFilterBar condensed>
            <EnvironmentPageFilter />
            <DatePageFilter />
          </PageFilterBar>
          {renderSearchBar()}
        </FilterActions>
        <PerformanceAtScaleContextProvider>
          <TransactionSummaryCharts
            organization={organization}
            location={location}
            eventView={eventView}
            totalValue={totalCount}
            currentFilter={spanOperationBreakdownFilter}
            withoutZerofill={hasPerformanceChartInterpolation}
            project={project}
          />
          <TransactionsList
            location={location}
            organization={organization}
            eventView={transactionsListEventView}
            {...openAllEventsProps}
            showTransactions={
              decodeScalar(
                location.query.showTransactions,
                TransactionFilterOptions.SLOW
              ) as TransactionFilterOptions
            }
            breakdown={decodeFilterFromLocation(location)}
            titles={transactionsListTitles}
            handleDropdownChange={handleTransactionsListSortChange}
            generateLink={{
              id: generateTransactionIdLink(transactionName),
              trace: generateTraceLink(eventView.normalizeDateSelection(location)),
              replayId: generateReplayLink(routes),
              'profile.id': generateProfileLink(),
            }}
            handleCellAction={handleCellAction}
            {...getTransactionsListSort(location, {
              p95: totalValues?.['p95()'] ?? 0,
              spanOperationBreakdownFilter,
            })}
            forceLoading={isLoading}
            referrer="performance.transactions_summary"
            supportsInvestigationRule
          />
        </PerformanceAtScaleContextProvider>

        {!hasNewSpansUIFlag && (
          <SuspectSpans
            location={location}
            organization={organization}
            eventView={eventView}
            totals={
              defined(totalValues?.['count()'])
                ? {'count()': totalValues!['count()']}
                : null
            }
            projectId={projectId}
            transactionName={transactionName}
          />
        )}

        <TagExplorer
          eventView={eventView}
          organization={organization}
          location={location}
          projects={projects}
          transactionName={transactionName}
          currentFilter={spanOperationBreakdownFilter}
        />

        <SuspectFunctionsTable
          project={project}
          transaction={transactionName}
          analyticsPageSource="performance_transaction"
        />
        <RelatedIssues
          organization={organization}
          location={location}
          transaction={transactionName}
          start={eventView.start}
          end={eventView.end}
          statsPeriod={eventView.statsPeriod}
        />
      </Layout.Main>
      <Layout.Side>
        <UserStats
          organization={organization}
          location={location}
          isLoading={isLoading}
          hasWebVitals={hasWebVitals}
          error={error}
          totals={totalValues}
          transactionName={transactionName}
          eventView={eventView}
        />
        {!isFrontendView && (
          <StatusBreakdown
            eventView={eventView}
            organization={organization}
            location={location}
          />
        )}
        <SidebarSpacer />
        <SidebarCharts
          organization={organization}
          isLoading={isLoading}
          error={error}
          totals={totalValues}
          eventView={eventView}
          transactionName={transactionName}
        />
        <SidebarSpacer />
        <Tags
          generateUrl={generateTagUrl}
          totalValues={totalCount}
          eventView={eventView}
          organization={organization}
          location={location}
        />
      </Layout.Side>
    </Fragment>
  );
}

function getFilterOptions({
  p95,
  spanOperationBreakdownFilter,
}: {
  p95: number;
  spanOperationBreakdownFilter: SpanOperationBreakdownFilter;
}): DropdownOption[] {
  if (spanOperationBreakdownFilter === SpanOperationBreakdownFilter.NONE) {
    return [
      {
        sort: {kind: 'asc', field: 'transaction.duration'},
        value: TransactionFilterOptions.FASTEST,
        label: t('Fastest Transactions'),
      },
      {
        query: p95 > 0 ? [['transaction.duration', `<=${p95.toFixed(0)}`]] : undefined,
        sort: {kind: 'desc', field: 'transaction.duration'},
        value: TransactionFilterOptions.SLOW,
        label: t('Slow Transactions (p95)'),
      },
      {
        sort: {kind: 'desc', field: 'transaction.duration'},
        value: TransactionFilterOptions.OUTLIER,
        label: t('Outlier Transactions (p100)'),
      },
      {
        sort: {kind: 'desc', field: 'timestamp'},
        value: TransactionFilterOptions.RECENT,
        label: t('Recent Transactions'),
      },
    ];
  }

  const field = filterToField(spanOperationBreakdownFilter)!;
  const operationName = spanOperationBreakdownFilter;

  return [
    {
      sort: {kind: 'asc', field},
      value: TransactionFilterOptions.FASTEST,
      label: t('Fastest %s Operations', operationName),
    },
    {
      query: p95 > 0 ? [['transaction.duration', `<=${p95.toFixed(0)}`]] : undefined,
      sort: {kind: 'desc', field},
      value: TransactionFilterOptions.SLOW,
      label: t('Slow %s Operations (p95)', operationName),
    },
    {
      sort: {kind: 'desc', field},
      value: TransactionFilterOptions.OUTLIER,
      label: t('Outlier %s Operations (p100)', operationName),
    },
    {
      sort: {kind: 'desc', field: 'timestamp'},
      value: TransactionFilterOptions.RECENT,
      label: t('Recent Transactions'),
    },
  ];
}

function getTransactionsListSort(
  location: Location,
  options: {p95: number; spanOperationBreakdownFilter: SpanOperationBreakdownFilter}
): {options: DropdownOption[]; selected: DropdownOption} {
  const sortOptions = getFilterOptions(options);
  const urlParam = decodeScalar(
    location.query.showTransactions,
    TransactionFilterOptions.SLOW
  );
  const selectedSort = sortOptions.find(opt => opt.value === urlParam) || sortOptions[0];
  return {selected: selectedSort, options: sortOptions};
}

function getTransactionFilterTags(): TagCollection {
  const combinedTags: TagCollection = {
    ...STATIC_SPAN_TAGS,
    ...STATIC_FIELD_TAGS_WITHOUT_ERROR_FIELDS,
  };
  return combinedTags;
}

function getTransactionFilterTagValues() {
  return [];
}

const FilterActions = styled('div')`
  display: grid;
  gap: ${space(2)};
  margin-bottom: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: repeat(2, min-content);
  }

  @media (min-width: ${p => p.theme.breakpoints.xlarge}) {
    grid-template-columns: auto auto 1fr;
  }
`;

const StyledSearchBarWrapper = styled('div')`
  @media (min-width: ${p => p.theme.breakpoints.small}) {
    order: 1;
    grid-column: 1/4;
  }

  @media (min-width: ${p => p.theme.breakpoints.xlarge}) {
    order: initial;
    grid-column: auto;
  }
`;

const StyledIconWarning = styled(IconWarning)`
  display: block;
`;

export default withProjects(SummaryContent);
