import * as React from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location, LocationDescriptor, Query} from 'history';

import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import Button from 'sentry/components/button';
import DiscoverButton from 'sentry/components/discoverButton';
import DropdownButton from 'sentry/components/dropdownButton';
import DropdownControl, {DropdownItem} from 'sentry/components/dropdownControl';
import Pagination, {CursorHandler} from 'sentry/components/pagination';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import DiscoverQuery, {TableDataRow} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {Sort} from 'sentry/utils/discover/fields';
import {TrendsEventsDiscoverQuery} from 'sentry/utils/performance/trends/trendsDiscoverQuery';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {Actions} from 'sentry/views/eventsV2/table/cellAction';
import {TableColumn} from 'sentry/views/eventsV2/table/types';
import {decodeColumnOrder} from 'sentry/views/eventsV2/utils';
import {SpanOperationBreakdownFilter} from 'sentry/views/performance/transactionSummary/filter';
import {mapShowTransactionToPercentile} from 'sentry/views/performance/transactionSummary/transactionEvents/utils';
import {TransactionFilterOptions} from 'sentry/views/performance/transactionSummary/utils';
import {TrendChangeType, TrendView} from 'sentry/views/performance/trends/types';

import TransactionsTable from './transactionsTable';

const DEFAULT_TRANSACTION_LIMIT = 5;

export type DropdownOption = {
  /**
   * The sort to apply to the eventView when this is selected.
   */
  sort: Sort;
  /**
   * The unique name to use for this option.
   */
  value: string;
  /**
   * The label to display in the dropdown
   */
  label: string;
  /**
   * Included if the option is for a trend
   */
  trendType?: TrendChangeType;
  /**
   * override the eventView query
   */
  query?: [string, string][];
};

type Props = {
  location: Location;
  eventView: EventView;
  trendView?: TrendView;
  organization: Organization;
  /**
   * The currently selected option on the dropdown.
   */
  selected: DropdownOption;
  /**
   * The available options for the dropdown.
   */
  options: DropdownOption[];
  /**
   * The callback for when the dropdown option changes.
   */
  handleDropdownChange: (k: string) => void;
  /**
   * The callback to generate a cell action handler for a column
   */
  handleCellAction?: (
    c: TableColumn<React.ReactText>
  ) => (a: Actions, v: React.ReactText) => void;
  /**
   * The name of the url parameter that contains the cursor info.
   */
  cursorName: string;
  /**
   * The limit to the number of results to fetch.
   */
  limit: number;
  /**
   * A list of preferred table headers to use over the field names.
   */
  titles?: string[];
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
  /**
   * The callback for when Open in Discover is clicked.
   */
  handleOpenInDiscoverClick?: (e: React.MouseEvent<Element>) => void;
  /**
   * The callback for when View All Events is clicked.
   */
  handleOpenAllEventsClick?: (e: React.MouseEvent<Element>) => void;
  /**
   * Show a loading indicator instead of the table, used for transaction summary p95.
   */
  forceLoading?: boolean;
  /**
   * Optional callback function to generate an alternative EventView object to be used
   * for generating the Discover query.
   */
  generateDiscoverEventView?: () => EventView;
  generatePerformanceTransactionEventsView?: () => EventView;
  showTransactions?: TransactionFilterOptions;
  breakdown?: SpanOperationBreakdownFilter;
};

class TransactionsList extends React.Component<Props> {
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

  renderHeader(): React.ReactNode {
    const {
      organization,
      selected,
      options,
      handleDropdownChange,
      handleOpenAllEventsClick,
      handleOpenInDiscoverClick,
      showTransactions,
      breakdown,
    } = this.props;

    return (
      <React.Fragment>
        <div>
          <DropdownControl
            button={({isOpen, getActorProps}) => (
              <StyledDropdownButton
                {...getActorProps()}
                isOpen={isOpen}
                prefix={t('Filter')}
                size="small"
              >
                {selected.label}
              </StyledDropdownButton>
            )}
          >
            {options.map(({value, label}) => (
              <DropdownItem
                data-test-id={`option-${value}`}
                key={value}
                onSelect={handleDropdownChange}
                eventKey={value}
                isActive={value === selected.value}
              >
                {label}
              </DropdownItem>
            ))}
          </DropdownControl>
        </div>
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
                size="small"
                data-test-id="transaction-events-open"
              >
                {t('View All Events')}
              </Button>
            </GuideAnchor>
          ) : (
            <GuideAnchor target="release_transactions_open_in_discover">
              <DiscoverButton
                onClick={handleOpenInDiscoverClick}
                to={this.generateDiscoverEventView().getResultsViewUrlTarget(
                  organization.slug
                )}
                size="small"
                data-test-id="discover-open"
              >
                {t('Open in Discover')}
              </DiscoverButton>
            </GuideAnchor>
          ))}
      </React.Fragment>
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
    } = this.props;

    const eventView = this.getEventView();
    const columnOrder = eventView.getColumns();
    const cursor = decodeScalar(location.query?.[cursorName]);

    const tableRenderer = ({isLoading, pageLinks, tableData}) => (
      <React.Fragment>
        <Header>
          {this.renderHeader()}
          <StyledPagination
            pageLinks={pageLinks}
            onCursor={this.handleCursor}
            size="small"
          />
        </Header>
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
        />
      </React.Fragment>
    );

    if (forceLoading) {
      return tableRenderer({
        isLoading: true,
        pageLinks: null,
        tableData: null,
      });
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
        {tableRenderer}
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
          <React.Fragment>
            <Header>
              {this.renderHeader()}
              <StyledPagination
                pageLinks={pageLinks}
                onCursor={this.handleCursor}
                size="small"
              />
            </Header>
            <TransactionsTable
              eventView={sortedEventView}
              organization={organization}
              location={location}
              isLoading={isLoading}
              tableData={trendsData}
              titles={['transaction', 'percentage', 'difference']}
              columnOrder={decodeColumnOrder([
                {field: 'transaction'},
                {field: 'trend_percentage()'},
                {field: 'trend_difference()'},
              ])}
              generateLink={generateLink}
            />
          </React.Fragment>
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
      <React.Fragment>
        {this.isTrend() ? this.renderTrendsTable() : this.renderTransactionTable()}
      </React.Fragment>
    );
  }
}

const Header = styled('div')`
  display: grid;
  grid-template-columns: 1fr auto auto;
  margin-bottom: ${space(1)};
`;

const StyledDropdownButton = styled(DropdownButton)`
  min-width: 145px;
`;

const StyledPagination = styled(Pagination)`
  margin: 0 0 0 ${space(1)};
`;

export default TransactionsList;
