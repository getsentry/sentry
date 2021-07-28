import * as React from 'react';
import {browserHistory} from 'react-router';
import {Location, LocationDescriptor, Query} from 'history';

import {Organization, ReleaseProject} from 'app/types';
import DiscoverQuery, {TableDataRow} from 'app/utils/discover/discoverQuery';
import EventView from 'app/utils/discover/eventView';
import {decodeScalar} from 'app/utils/queryString';
import {SpanOperationBreakdownFilter} from 'app/views/performance/transactionSummary/filter';
import {TransactionFilterOptions} from 'app/views/performance/transactionSummary/utils';

import PerformanceCardTable from './performanceCardTable';

const DEFAULT_TRANSACTION_LIMIT = 5;

type Props = {
  location: Location;
  eventView: EventView;
  releaseEventView: EventView;
  organization: Organization;
  project: ReleaseProject;
  /**
   * The name of the url parameter that contains the cursor info.
   */
  cursorName: string;
  /**
   * The limit to the number of results to fetch.
   */
  limit: number;
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

class PerformanceCardList extends React.Component<Props> {
  static defaultProps = {
    cursorName: 'transactionCursor',
    limit: DEFAULT_TRANSACTION_LIMIT,
  };

  handleCursor = (cursor: string, pathname: string, query: Query) => {
    const {cursorName} = this.props;
    browserHistory.push({
      pathname,
      query: {...query, [cursorName]: cursor},
    });
  };

  renderTransactionTable(): React.ReactNode {
    const {
      location,
      organization,
      project,
      cursorName,
      limit,
      generateLink,
      forceLoading,
      eventView,
      releaseEventView,
    } = this.props;
    const columnOrder = eventView.getColumns();
    const cursor = decodeScalar(location.query?.[cursorName]);

    const tableRenderer = ({isLoading, tableData, releaseTableData}) => (
      <React.Fragment>
        <PerformanceCardTable
          eventView={eventView}
          releaseEventView={releaseEventView}
          organization={organization}
          project={project}
          location={location}
          isLoading={isLoading}
          tableData={tableData}
          releaseTableData={releaseTableData}
          columnOrder={columnOrder}
          generateLink={generateLink}
        />
      </React.Fragment>
    );

    if (forceLoading) {
      return tableRenderer({
        isLoading: true,
        tableData: null,
        releaseTableData: null,
      });
    }

    return (
      <DiscoverQuery
        location={location}
        eventView={eventView}
        releaseEventView={releaseEventView}
        orgSlug={organization.slug}
        limit={limit}
        cursor={cursor}
        referrer="api.discover.transactions-list"
      >
        {tableRenderer}
      </DiscoverQuery>
    );
  }

  render() {
    return <React.Fragment>{this.renderTransactionTable()}</React.Fragment>;
  }
}

export default PerformanceCardList;
