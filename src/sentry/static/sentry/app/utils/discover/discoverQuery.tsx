import React from 'react';
import {Location} from 'history';

import {Client} from 'app/api';
import withApi from 'app/utils/withApi';
import EventView, {
  MetaType,
  isAPIPayloadSimilar,
  LocationQuery,
} from 'app/utils/discover/eventView';
import {EventQuery} from 'app/actionCreators/events';
import {TrendChangeType} from 'app/views/performance/trends/types';
import {getCurrentTrendFunction} from 'app/views/performance/trends/utils';

/**
 * An individual row in a DiscoverQuery result
 */
export type TableDataRow = {
  id: string;
  [key: string]: React.ReactText;
};

/**
 * A DiscoverQuery result including rows and metadata.
 */
export type TableData = {
  data: Array<TableDataRow>;
  meta?: MetaType;
};

type ChildrenProps = {
  isLoading: boolean;
  error: null | string;
  tableData: TableData | null;
  pageLinks: null | string;
};

type Props = {
  api: Client;
  location: Location;
  eventView: EventView;
  orgSlug: string;
  keyTransactions?: boolean;
  trendChangeType?: TrendChangeType;
  limit?: number;

  children: (props: ChildrenProps) => React.ReactNode;
};

type State = {
  tableFetchID: symbol | undefined;
} & ChildrenProps;

type TrendsQuery = {
  trendFunction?: string;
  intervalRatio?: number;
  interval?: string;
};

class DiscoverQuery extends React.Component<Props, State> {
  static defaultProps = {
    keyTransactions: false,
  };

  state: State = {
    isLoading: true,
    tableFetchID: undefined,
    error: null,

    tableData: null,
    pageLinks: null,
  };

  componentDidMount() {
    this.fetchData();
  }

  componentDidUpdate(prevProps: Props) {
    // Reload data if we aren't already loading,
    const refetchCondition = !this.state.isLoading && this.shouldRefetchData(prevProps);

    // or if we've moved from an invalid view state to a valid one,
    const eventViewValidation =
      prevProps.eventView.isValid() === false && this.props.eventView.isValid();

    // or if toggling between key transactions and all transactions
    const togglingTransactionsView =
      prevProps.keyTransactions !== this.props.keyTransactions;

    if (refetchCondition || eventViewValidation || togglingTransactionsView) {
      this.fetchData();
    }
  }

  shouldRefetchData = (prevProps: Props): boolean => {
    const thisAPIPayload = this.props.eventView.getEventsAPIPayload(this.props.location);
    const otherAPIPayload = prevProps.eventView.getEventsAPIPayload(prevProps.location);

    return (
      !isAPIPayloadSimilar(thisAPIPayload, otherAPIPayload) ||
      prevProps.limit !== this.props.limit
    );
  };

  getRoute(keyTransactions, trendsType) {
    if (keyTransactions) {
      return 'key-transactions';
    }
    if (trendsType) {
      return 'events-trends';
    }
    return 'eventsv2';
  }

  fetchData = () => {
    const {
      eventView,
      orgSlug,
      location,
      limit,
      keyTransactions,
      trendChangeType,
    } = this.props;

    if (!eventView.isValid()) {
      return;
    }

    const route = this.getRoute(keyTransactions, trendChangeType);

    const url = `/organizations/${orgSlug}/${route}/`;
    const tableFetchID = Symbol(`tableFetchID`);
    const apiPayload: EventQuery &
      LocationQuery &
      TrendsQuery = eventView.getEventsAPIPayload(location);

    this.modifyTrendsPayload(apiPayload);

    this.setState({isLoading: true, tableFetchID});

    if (limit) {
      apiPayload.per_page = limit;
    }

    this.props.api
      .requestPromise(url, {
        method: 'GET',
        includeAllArgs: true,
        query: {
          // marking apiPayload as any so as to not cause typescript errors
          ...(apiPayload as any),
        },
      })
      .then(([data, _, jqXHR]) => {
        if (this.state.tableFetchID !== tableFetchID) {
          // invariant: a different request was initiated after this request
          return;
        }

        this.setState(prevState => ({
          isLoading: false,
          tableFetchID: undefined,
          error: null,
          pageLinks: jqXHR ? jqXHR.getResponseHeader('Link') : prevState.pageLinks,
          tableData: data,
        }));
      })
      .catch(err => {
        this.setState({
          isLoading: false,
          tableFetchID: undefined,
          error: err?.responseJSON?.detail ?? null,
          tableData: null,
        });
      });
  };

  modifyTrendsPayload = (apiPayload: EventQuery & LocationQuery & TrendsQuery) => {
    const {trendChangeType, location, eventView} = this.props;
    if (trendChangeType) {
      const trendFunction = getCurrentTrendFunction(location);
      apiPayload.trendFunction = trendFunction.field;
      apiPayload.interval = eventView.interval;
    }
  };

  render() {
    const {isLoading, error, tableData, pageLinks} = this.state;

    const childrenProps = {
      isLoading,
      error,
      tableData,
      pageLinks,
    };

    return this.props.children(childrenProps);
  }
}

export default withApi(DiscoverQuery);
