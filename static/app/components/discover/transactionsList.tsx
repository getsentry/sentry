import {Component, Fragment, useContext, useEffect} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location, LocationDescriptor, Query} from 'history';

import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import {Button} from 'sentry/components/button';
import {CompactSelect} from 'sentry/components/compactSelect';
import DiscoverButton from 'sentry/components/discoverButton';
import {InvestigationRuleCreation} from 'sentry/components/dynamicSampling/investigationRule';
import Pagination, {CursorHandler} from 'sentry/components/pagination';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {parseCursor} from 'sentry/utils/cursor';
import DiscoverQuery, {TableDataRow} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {Sort} from 'sentry/utils/discover/fields';
import {TrendsEventsDiscoverQuery} from 'sentry/utils/performance/trends/trendsDiscoverQuery';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {Actions} from 'sentry/views/discover/table/cellAction';
import {TableColumn} from 'sentry/views/discover/table/types';
import {decodeColumnOrder} from 'sentry/views/discover/utils';
import {SpanOperationBreakdownFilter} from 'sentry/views/performance/transactionSummary/filter';
import {mapShowTransactionToPercentile} from 'sentry/views/performance/transactionSummary/transactionEvents/utils';
import {PerformanceAtScaleContext} from 'sentry/views/performance/transactionSummary/transactionOverview/performanceAtScaleContext';
import {
  DisplayModes,
  TransactionFilterOptions,
} from 'sentry/views/performance/transactionSummary/utils';
import {TrendChangeType, TrendView} from 'sentry/views/performance/trends/types';

import TransactionsTable from './transactionsTable';

const DEFAULT_TRANSACTION_LIMIT = 5;

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
  query?: [string, string][];
  /**
   * Included if the option is for a trend
   */
  trendType?: TrendChangeType;
};

type Props = {
  /**
   * The name of the url parameter that contains the cursor info.
   */
  cursorName: string;
  eventView: EventView;
  /**
   * The callback for when the dropdown option changes.
   */
  handleDropdownChange: (k: string) => void;
  /**
   * The limit to the number of results to fetch.
   */
  limit: number;
  location: Location;
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
      query: Query
    ) => LocationDescriptor
  >;
  generatePerformanceTransactionEventsView?: () => EventView;
  /**
   * The callback to generate a cell action handler for a column
   */
  handleCellAction?: (
    c: TableColumn<React.ReactText>
  ) => (a: Actions, v: React.ReactText) => void;
  /**
   * The callback for when View All Events is clicked.
   */
  handleOpenAllEventsClick?: (e: React.MouseEvent<Element>) => void;
  /**
   * The callback for when Open in Discover is clicked.
   */
  handleOpenInDiscoverClick?: (e: React.MouseEvent<Element>) => void;
  referrer?: string;
  showTransactions?: TransactionFilterOptions;
  supportsInvestigationRule?: boolean;
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
    target?: string;
  };

function TableRender({
  pageLinks,
  onCursor,
  header,
  eventView,
  organization,
  isLoading,
  location,
  columnOrder,
  tableData,
  titles,
  generateLink,
  handleCellAction,
  referrer,
  useAggregateAlias,
  target,
  paginationCursorSize,
}: TableRenderProps) {
  const query = decodeScalar(location.query.query, '');
  const display = decodeScalar(location.query.display, DisplayModes.DURATION);
  const performanceAtScaleContext = useContext(PerformanceAtScaleContext);
  const hasResults =
    tableData && tableData.data && tableData.meta && tableData.data.length > 0;

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
      !hasResults === performanceAtScaleContext.transactionListTableData?.empty &&
      query === performanceAtScaleContext.transactionListTableData?.query
    ) {
      return;
    }

    performanceAtScaleContext.setTransactionListTableData({
      empty: !hasResults,
      query,
    });
  }, [display, isLoading, hasResults, performanceAtScaleContext, query]);

  const content = (
    <TransactionsTable
      eventView={eventView}
      organization={organization}
      location={location}
      isLoading={isLoading}
      tableData={tableData}
      columnOrder={columnOrder}
      titles={titles}
      generateLink={generateLink}
      handleCellAction={handleCellAction}
      useAggregateAlias={useAggregateAlias}
      referrer={referrer}
    />
  );

  return (
    <Fragment>
      <Header>
        {header}
        <StyledPagination
          pageLinks={pageLinks}
          onCursor={onCursor}
          size={paginationCursorSize}
        />
      </Header>
      {target ? (
        <GuideAnchor target={target} position="top-start">
          {content}
        </GuideAnchor>
      ) : (
        content
      )}
    </Fragment>
  );
}

class _TransactionsList extends Component<Props> {
  static defaultProps = {
    cursorName: 'transactionCursor',
    limit: DEFAULT_TRANSACTION_LIMIT,
  };

  handleCursor: CursorHandler = (cursor, pathname, query) => {
    const {cursorName} = this.props;
    browserHistory.push({
      pathname,
      query: {...query, [cursorName]: cursor},
    });
  };

  getEventView() {
    const {eventView, selected} = this.props;

    const sortedEventView = eventView.withSorts([selected.sort]);
    if (selected.query) {
      const query = new MutableSearch(sortedEventView.query);
      selected.query.forEach(item => query.setFilterValues(item[0], [item[1]]));
      sortedEventView.query = query.formatString();
    }

    return sortedEventView;
  }

  generateDiscoverEventView(): EventView {
    const {generateDiscoverEventView} = this.props;
    if (typeof generateDiscoverEventView === 'function') {
      return generateDiscoverEventView();
    }
    return this.getEventView();
  }

  generatePerformanceTransactionEventsView(): EventView {
    const {generatePerformanceTransactionEventsView} = this.props;
    return generatePerformanceTransactionEventsView?.() ?? this.getEventView();
  }

  renderHeader({
    cursor,
    numSamples,
    supportsInvestigationRule,
  }: {
    numSamples: number | null | undefined;
    cursor?: string | undefined;
    supportsInvestigationRule?: boolean;
  }): React.ReactNode {
    const {
      organization,
      selected,
      options,
      handleDropdownChange,
      handleOpenAllEventsClick,
      handleOpenInDiscoverClick,
      showTransactions,
      breakdown,
      eventView,
    } = this.props;
    const cursorOffset = parseCursor(cursor)?.offset ?? 0;
    numSamples = numSamples ?? null;
    const totalNumSamples = numSamples === null ? null : numSamples + cursorOffset;
    return (
      <Fragment>
        <div>
          <CompactSelect
            triggerProps={{prefix: t('Filter'), size: 'xs'}}
            value={selected.value}
            options={options}
            onChange={opt => handleDropdownChange(opt.value)}
          />
        </div>
        {supportsInvestigationRule && (
          <InvestigationRuleWrapper>
            <InvestigationRuleCreation
              buttonProps={{size: 'xs'}}
              eventView={eventView}
              numSamples={totalNumSamples}
            />
          </InvestigationRuleWrapper>
        )}
        {!this.isTrend() &&
          (handleOpenAllEventsClick ? (
            <GuideAnchor target="release_transactions_open_in_transaction_events">
              <Button
                onClick={handleOpenAllEventsClick}
                to={this.generatePerformanceTransactionEventsView().getPerformanceTransactionEventsViewUrlTarget(
                  organization.slug,
                  {
                    showTransactions: mapShowTransactionToPercentile(showTransactions),
                    breakdown,
                  }
                )}
                size="xs"
                data-test-id="transaction-events-open"
              >
                {t('View Sampled Events')}
              </Button>
            </GuideAnchor>
          ) : (
            <GuideAnchor target="release_transactions_open_in_discover">
              <DiscoverButton
                onClick={handleOpenInDiscoverClick}
                to={this.generateDiscoverEventView().getResultsViewUrlTarget(
                  organization.slug
                )}
                size="xs"
                data-test-id="discover-open"
              >
                {t('Open in Discover')}
              </DiscoverButton>
            </GuideAnchor>
          ))}
      </Fragment>
    );
  }

  renderTransactionTable(): React.ReactNode {
    const {
      location,
      organization,
      handleCellAction,
      cursorName,
      limit,
      titles,
      generateLink,
      forceLoading,
      referrer,
    } = this.props;

    const eventView = this.getEventView();
    const columnOrder = eventView.getColumns();
    const cursor = decodeScalar(location.query?.[cursorName]);
    const tableCommonProps: Omit<
      TableRenderProps,
      'isLoading' | 'pageLinks' | 'tableData' | 'header'
    > = {
      handleCellAction,
      referrer,
      eventView,
      organization,
      location,
      columnOrder,
      titles,
      generateLink,
      useAggregateAlias: false,
      target: 'transactions_table',
      paginationCursorSize: 'xs',
      onCursor: this.handleCursor,
    };

    if (forceLoading) {
      return (
        <TableRender
          {...tableCommonProps}
          isLoading
          pageLinks={null}
          tableData={null}
          header={this.renderHeader({numSamples: null})}
        />
      );
    }

    return (
      <DiscoverQuery
        location={location}
        eventView={eventView}
        orgSlug={organization.slug}
        limit={limit}
        cursor={cursor}
        referrer="api.discover.transactions-list"
      >
        {({isLoading, pageLinks, tableData}) => (
          <TableRender
            {...tableCommonProps}
            isLoading={isLoading}
            pageLinks={pageLinks}
            tableData={tableData}
            header={this.renderHeader({
              numSamples: tableData?.data?.length ?? null,
              supportsInvestigationRule: this.props.supportsInvestigationRule,
              cursor,
            })}
          />
        )}
      </DiscoverQuery>
    );
  }

  renderTrendsTable(): React.ReactNode {
    const {trendView, location, selected, organization, cursorName, generateLink} =
      this.props;

    const sortedEventView: TrendView = trendView!.clone();
    sortedEventView.sorts = [selected.sort];
    sortedEventView.trendType = selected.trendType;
    if (selected.query) {
      const query = new MutableSearch(sortedEventView.query);
      selected.query.forEach(item => query.setFilterValues(item[0], [item[1]]));
      sortedEventView.query = query.formatString();
    }
    const cursor = decodeScalar(location.query?.[cursorName]);

    return (
      <TrendsEventsDiscoverQuery
        eventView={sortedEventView}
        orgSlug={organization.slug}
        location={location}
        cursor={cursor}
        limit={5}
      >
        {({isLoading, trendsData, pageLinks}) => (
          <TableRender
            organization={organization}
            eventView={sortedEventView}
            location={location}
            isLoading={isLoading}
            tableData={trendsData}
            pageLinks={pageLinks}
            onCursor={this.handleCursor}
            paginationCursorSize="sm"
            header={this.renderHeader({
              numSamples: null,
              supportsInvestigationRule: false,
            })}
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
      </TrendsEventsDiscoverQuery>
    );
  }

  isTrend(): boolean {
    const {selected} = this.props;
    return selected.trendType !== undefined;
  }

  render() {
    return (
      <Fragment>
        {this.isTrend() ? this.renderTrendsTable() : this.renderTransactionTable()}
      </Fragment>
    );
  }
}

const Header = styled('div')`
  display: grid;
  grid-template-columns: 1fr auto auto auto;
  margin-bottom: ${space(1)};
  align-items: center;
`;

const StyledPagination = styled(Pagination)`
  margin: 0 0 0 ${space(1)};
`;

const InvestigationRuleWrapper = styled('div')`
  margin-right: ${space(1)};
`;

function TransactionsList(
  props: Omit<Props, 'cursorName' | 'limit'> & {
    cursorName?: Props['cursorName'];
    limit?: Props['limit'];
  }
) {
  return <_TransactionsList {...props} />;
}

export default TransactionsList;
