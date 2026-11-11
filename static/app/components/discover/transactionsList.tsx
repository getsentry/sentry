import {Fragment, useContext, useEffect} from 'react';
import {css} from '@emotion/react';
import type {Location, LocationDescriptor} from 'history';
import {parseAsString, useQueryState, useQueryStates} from 'nuqs';

import {LinkButton} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Container, Grid} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import type {CursorHandler} from '@sentry/scraps/pagination';
import {Pagination} from '@sentry/scraps/pagination';

import {GuideAnchor} from 'sentry/components/assistant/guideAnchor';
import {DiscoverButton} from 'sentry/components/discoverButton';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {DemoTourElement, DemoTourStep} from 'sentry/utils/demoMode/demoTours';
import {decodeColumnOrder} from 'sentry/utils/discover/decodeColumnOrder';
import type {TableDataRow} from 'sentry/utils/discover/discoverQuery';
import {DiscoverQuery} from 'sentry/utils/discover/discoverQuery';
import type {EventView} from 'sentry/utils/discover/eventView';
import type {Sort} from 'sentry/utils/discover/fields';
import {isAggregateField, parseFunction} from 'sentry/utils/discover/fields';
import {getFieldDefinition} from 'sentry/utils/fields';
import {TrendsEventsDiscoverQuery} from 'sentry/utils/performance/trends/trendsDiscoverQuery';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import type {Actions} from 'sentry/views/discover/table/cellAction';
import type {TableColumn} from 'sentry/views/discover/table/types';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {parseAsScalar} from 'sentry/views/explore/queryParams/parsers';
import {getExploreUrl} from 'sentry/views/explore/utils';
import type {DomainViewFilters} from 'sentry/views/insights/pages/useFilters';
import type {SpanOperationBreakdownFilter} from 'sentry/views/performance/transactionSummary/filter';
import {mapShowTransactionToPercentile} from 'sentry/views/performance/transactionSummary/transactionEvents/utils';
import {PerformanceAtScaleContext} from 'sentry/views/performance/transactionSummary/transactionOverview/performanceAtScaleContext';
import type {TransactionFilterOptions} from 'sentry/views/performance/transactionSummary/utils';
import {DisplayModes} from 'sentry/views/performance/transactionSummary/utils';
import type {TrendChangeType, TrendView} from 'sentry/views/performance/trends/types';

import {TransactionsTable} from './transactionsTable';

const DEFAULT_TRANSACTION_LIMIT = 5;
const TRANSACTION_CURSOR_NAME = 'transactionCursor';

/**
 * Normalize an aggregate yAxis so it carries an explicit column argument where
 * the spans dataset requires one (e.g. `p50()` -> `p50(span.duration)`).
 */
function normalizeExploreYAxis(yAxis: string): string {
  const parsed = parseFunction(yAxis);
  if (!parsed || parsed.arguments.length > 0) {
    return yAxis;
  }

  const definition = getFieldDefinition(parsed.name, 'span');
  const columnParameter = definition?.parameters?.find(
    parameter => parameter.kind === 'column'
  );
  if (columnParameter?.defaultValue) {
    return `${parsed.name}(${columnParameter.defaultValue})`;
  }

  return yAxis;
}

/**
 * Build an Explore > Traces URL that reproduces the aggregate view described by
 * the given (spans dataset) EventView.
 */
function getExploreTarget(eventView: EventView, organization: Organization): string {
  const fields = eventView.getFields();
  const groupBy = fields.filter(field => !isAggregateField(field));
  const yAxes = fields.filter(isAggregateField).map(normalizeExploreYAxis);

  const sort = eventView.sorts[0];
  let aggregateSort: string | undefined;
  if (sort) {
    const sortedYAxis = yAxes.find(yAxis => parseFunction(yAxis)?.name === sort.field);
    if (sortedYAxis) {
      aggregateSort = `${sort.kind === 'desc' ? '-' : ''}${sortedYAxis}`;
    }
  }

  // Explore's search cannot express aggregate (HAVING) conditions such as
  // `epm():>0.01`.
  const search = new MutableSearch(eventView.query);
  Object.keys(search.filters).forEach(key => {
    if (isAggregateField(key)) {
      search.removeFilter(key);
    }
  });

  return getExploreUrl({
    organization,
    selection: eventView.getPageFilters(),
    mode: Mode.AGGREGATE,
    query: search.formatString(),
    groupBy,
    visualize: yAxes.length > 0 ? [{yAxes}] : undefined,
    aggregateSort,
  });
}

export type DropdownOption = {
  /**
   * The label to display in the dropdown
   */
  label: string;
  /**
   * The sort to apply to the eventView when this is selected.
   */
  sort: Sort;
  /**
   * The unique name to use for this option.
   */
  value: string;
  /**
   * override the eventView query
   */
  query?: Array<[string, string]>;
  /**
   * Included if the option is for a trend
   */
  trendType?: TrendChangeType;
};

type Props = {
  eventView: EventView;
  /**
   * The callback for when the dropdown option changes.
   */
  handleDropdownChange: (k: string) => void;
  /**
   * The available options for the dropdown.
   */
  options: DropdownOption[];
  organization: Organization;
  /**
   * The currently selected option on the dropdown.
   */
  selected: DropdownOption;
  breakdown?: SpanOperationBreakdownFilter;
  domainViewFilters?: DomainViewFilters;
  /**
   * Show a loading indicator instead of the table, used for transaction summary p95.
   */
  forceLoading?: boolean;
  /**
   * Optional callback function to generate an alternative EventView object to be used
   * for generating the Discover query.
   */
  generateDiscoverEventView?: () => EventView;
  /**
   * A map of callbacks to generate a link for a column based on the title.
   */
  generateLink?: Record<
    string,
    (
      organization: Organization,
      tableRow: TableDataRow,
      location: Location
    ) => LocationDescriptor
  >;
  generatePerformanceTransactionEventsView?: () => EventView;
  /**
   * The callback to generate a cell action handler for a column
   */
  handleCellAction?: (
    c: TableColumn<string | number>
  ) => (a: Actions, v: string | number) => void;
  /**
   * The callback for when View All Events is clicked.
   */
  handleOpenAllEventsClick?: (e: React.MouseEvent) => void;
  /**
   * The callback for when Open in Discover is clicked.
   */
  handleOpenInDiscoverClick?: (e: React.MouseEvent) => void;
  referrer?: string;
  showTransactions?: TransactionFilterOptions;
  /**
   * A list of preferred table headers to use over the field names.
   */
  titles?: string[];
  trendView?: TrendView;
};

type TableRenderProps = Omit<React.ComponentProps<typeof Pagination>, 'size'> &
  React.ComponentProps<typeof TransactionsTable> & {
    header: React.ReactNode;
    paginationCursorSize: React.ComponentProps<typeof Pagination>['size'];
  };

const tableRenderParsers = {
  query: parseAsString.withDefault(''),
  display: parseAsScalar.withDefault(DisplayModes.DURATION),
};

function TableRender({
  pageLinks,
  onCursor,
  header,
  eventView,
  organization,
  isLoading,
  columnOrder,
  tableData,
  titles,
  generateLink,
  handleCellAction,
  referrer,
  useAggregateAlias,
  paginationCursorSize,
}: TableRenderProps) {
  const [{query, display}] = useQueryStates(tableRenderParsers);
  const performanceAtScaleContext = useContext(PerformanceAtScaleContext);
  const hasResults = tableData?.meta && tableData.data?.length > 0;

  useEffect(() => {
    if (!performanceAtScaleContext) {
      return;
    }

    // we are now only collecting analytics data from the transaction summary page
    // when the display mode is set to duration
    if (display !== DisplayModes.DURATION) {
      return;
    }

    if (isLoading || hasResults === null) {
      performanceAtScaleContext.setTransactionListTableData(undefined);
      return;
    }

    if (
      hasResults !== performanceAtScaleContext.transactionListTableData?.empty &&
      query === performanceAtScaleContext.transactionListTableData?.query
    ) {
      return;
    }

    performanceAtScaleContext.setTransactionListTableData({
      empty: !hasResults,
      query,
    });
  }, [display, isLoading, hasResults, performanceAtScaleContext, query]);

  return (
    <Fragment>
      <Grid
        align="center"
        columns={{zero: '1fr', md: '1fr auto'}}
        gap="md"
        marginBottom="md"
      >
        {header}
        <Pagination
          pageLinks={pageLinks}
          onCursor={onCursor}
          size={paginationCursorSize}
          css={css`
            margin: 0;
          `}
        />
      </Grid>
      <DemoTourElement
        id={DemoTourStep.PERFORMANCE_TRANSACTION_SUMMARY_TABLE}
        title={t('Breakdown event spans')}
        description={t(
          'Select an Event ID from a list of slow transactions to uncover slow spans.'
        )}
      >
        {props => (
          <div {...props}>
            <TransactionsTable
              eventView={eventView}
              organization={organization}
              isLoading={isLoading}
              tableData={tableData}
              columnOrder={columnOrder}
              titles={titles}
              generateLink={generateLink}
              handleCellAction={handleCellAction}
              useAggregateAlias={useAggregateAlias}
              referrer={referrer}
            />
          </div>
        )}
      </DemoTourElement>
    </Fragment>
  );
}

function LocationDiscoverQuery(
  props: Omit<React.ComponentProps<typeof DiscoverQuery>, 'location'>
) {
  const location = useLocation();
  return <DiscoverQuery {...props} location={location} />;
}

function LocationTrendsEventsDiscoverQuery(
  props: Omit<React.ComponentProps<typeof TrendsEventsDiscoverQuery>, 'location'>
) {
  const location = useLocation();
  return <TrendsEventsDiscoverQuery {...props} location={location} />;
}

function getSortedEventView({eventView, selected}: Props): EventView {
  const sortedEventView = eventView.withSorts([selected.sort]);
  if (selected.query) {
    const query = new MutableSearch(sortedEventView.query);
    selected.query.forEach(item => query.setFilterValues(item[0], [item[1]]));
    sortedEventView.query = query.formatString();
  }

  return sortedEventView;
}

function TransactionsListHeader(props: Props) {
  const {
    organization,
    selected,
    options,
    handleDropdownChange,
    handleOpenAllEventsClick,
    handleOpenInDiscoverClick,
    showTransactions,
    breakdown,
    domainViewFilters,
  } = props;

  return (
    <Grid columns={{zero: '1fr', md: 'repeat(2, max-content)'}} gap="md">
      <Container width={{zero: '100%', md: 'max-content'}}>
        {containerProps => (
          <CompactSelect
            {...containerProps}
            trigger={triggerProps => (
              <OverlayTrigger.Button
                {...triggerProps}
                prefix={t('Filter')}
                size="xs"
                style={{width: '100%'}}
              />
            )}
            value={selected.value}
            options={options}
            onChange={opt => handleDropdownChange(opt.value)}
          />
        )}
      </Container>
      {selected.trendType === undefined &&
        (handleOpenAllEventsClick ? (
          <GuideAnchor target="release_transactions_open_in_transaction_events">
            <LinkButton
              onClick={handleOpenAllEventsClick}
              to={(
                props.generatePerformanceTransactionEventsView?.() ??
                getSortedEventView(props)
              ).getPerformanceTransactionEventsViewUrlTarget(organization, {
                showTransactions: mapShowTransactionToPercentile(showTransactions),
                breakdown,
                view: domainViewFilters?.view,
              })}
              size="xs"
              data-test-id="transaction-events-open"
            >
              {t('View Sampled Events')}
            </LinkButton>
          </GuideAnchor>
        ) : (
          <GuideAnchor target="release_transactions_open_in_discover">
            <DiscoverButton
              onClick={handleOpenInDiscoverClick}
              to={getExploreTarget(
                typeof props.generateDiscoverEventView === 'function'
                  ? props.generateDiscoverEventView()
                  : getSortedEventView(props),
                organization
              )}
              size="xs"
              data-test-id="discover-open"
            >
              {t('Open in Explore')}
            </DiscoverButton>
          </GuideAnchor>
        ))}
    </Grid>
  );
}

export function TransactionsList(props: Props) {
  const {
    selected,
    organization,
    handleCellAction,
    titles,
    generateLink,
    forceLoading,
    referrer,
    trendView,
  } = props;
  const [cursor, setCursor] = useQueryState(
    TRANSACTION_CURSOR_NAME,
    parseAsScalar.withOptions({history: 'push'})
  );

  const handleCursor: CursorHandler = newCursor => {
    setCursor(newCursor ?? null);
  };

  const header = <TransactionsListHeader {...props} />;

  if (selected.trendType !== undefined) {
    const sortedEventView: TrendView = trendView!.clone();
    sortedEventView.sorts = [selected.sort];
    sortedEventView.trendType = selected.trendType;
    if (selected.query) {
      const query = new MutableSearch(sortedEventView.query);
      selected.query.forEach(item => query.setFilterValues(item[0], [item[1]]));
      sortedEventView.query = query.formatString();
    }

    return (
      <LocationTrendsEventsDiscoverQuery
        eventView={sortedEventView}
        orgSlug={organization.slug}
        cursor={cursor ?? undefined}
        limit={5}
      >
        {({isLoading, trendsData, pageLinks}) => (
          <TableRender
            organization={organization}
            eventView={sortedEventView}
            isLoading={isLoading}
            tableData={trendsData}
            pageLinks={pageLinks}
            onCursor={handleCursor}
            paginationCursorSize="sm"
            header={header}
            titles={['transaction', 'percentage', 'difference']}
            columnOrder={decodeColumnOrder([
              {field: 'transaction'},
              {field: 'trend_percentage()'},
              {field: 'trend_difference()'},
            ])}
            generateLink={generateLink}
            useAggregateAlias
          />
        )}
      </LocationTrendsEventsDiscoverQuery>
    );
  }

  const eventView = getSortedEventView(props);
  const tableCommonProps: Omit<
    TableRenderProps,
    'isLoading' | 'pageLinks' | 'tableData' | 'header'
  > = {
    handleCellAction,
    referrer,
    eventView,
    organization,
    columnOrder: eventView.getColumns(),
    titles,
    generateLink,
    useAggregateAlias: false,
    paginationCursorSize: 'xs',
    onCursor: handleCursor,
  };

  if (forceLoading) {
    return (
      <TableRender
        {...tableCommonProps}
        isLoading
        pageLinks={null}
        tableData={null}
        header={header}
      />
    );
  }

  return (
    <LocationDiscoverQuery
      eventView={eventView}
      orgSlug={organization.slug}
      limit={DEFAULT_TRANSACTION_LIMIT}
      cursor={cursor ?? undefined}
      referrer="api.discover.transactions-list"
    >
      {({isLoading, pageLinks, tableData}) => (
        <TableRender
          {...tableCommonProps}
          isLoading={isLoading}
          pageLinks={pageLinks}
          tableData={tableData}
          header={header}
        />
      )}
    </LocationDiscoverQuery>
  );
}
