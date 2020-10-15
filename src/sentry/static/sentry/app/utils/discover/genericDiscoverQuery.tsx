import React from 'react';
import {Location} from 'history';

import {Client} from 'app/api';
import EventView, {
  isAPIPayloadSimilar,
  LocationQuery,
} from 'app/utils/discover/eventView';
import {EventQuery} from 'app/actionCreators/events';

export type GenericChildrenProps<T> = {
  isLoading: boolean;
  error: null | string;
  tableData: T | null;
  pageLinks: null | string;
};

export type DiscoverQueryProps = {
  api: Client;
  /**
   * Used as the default source for cursor values.
   */
  location: Location;
  eventView: EventView;
  orgSlug: string;
  /**
   * Record limit to get.
   */
  limit?: number;
  /**
   * Explicit cursor value if you aren't using `location.query.cursor` because there are
   * multiple paginated results on the page.
   */
  cursor?: string;
};

type RequestProps<P> = DiscoverQueryProps & P;

type ReactProps<T> = {
  children?: (props: GenericChildrenProps<T>) => React.ReactNode;
};

type Props<T, P> = RequestProps<P> &
  ReactProps<T> & {
    /**
     * Route to the endpoint
     */
    route: string;
    /**
     * Allows components to modify the payload before it is set.
     */
    getRequestPayload?: (props: Props<T, P>) => any;
    /**
     * An external hook in addition to the event view check to check if data should be refetched
     */
    shouldRefetchData?: (prevProps: Props<T, P>, props: Props<T, P>) => boolean;
    /**
     * A hook before fetch that can be used to do things like clearing the api
     */
    beforeFetch?: (api: Client) => void;
    /**
     * A hook to modify data into the correct output after data has been received
     */
    afterFetch?: (data: any, props: Props<T, P>) => T;
  };

type State<T> = {
  tableFetchID: symbol | undefined;
} & GenericChildrenProps<T>;

/**
 * Generic component for discover queries
 */
class GenericDiscoverQuery<T, P> extends React.Component<Props<T, P>, State<T>> {
  static defaultProps = {
    keyTransactions: false,
  };

  state: State<T> = {
    isLoading: true,
    tableFetchID: undefined,
    error: null,

    tableData: null,
    pageLinks: null,
  };

  componentDidMount() {
    this.fetchData();
  }

  componentDidUpdate(prevProps: Props<T, P>) {
    // Reload data if we aren't already loading,
    const refetchCondition = !this.state.isLoading && this._shouldRefetchData(prevProps);

    // or if we've moved from an invalid view state to a valid one,
    const eventViewValidation =
      prevProps.eventView.isValid() === false && this.props.eventView.isValid();

    const shouldRefetchExternal = this.props.shouldRefetchData
      ? this.props.shouldRefetchData(prevProps, this.props)
      : false;

    if (refetchCondition || eventViewValidation || shouldRefetchExternal) {
      this.fetchData();
    }
  }

  getPayload(props: Props<T, P>) {
    if (this.props.getRequestPayload) {
      return this.props.getRequestPayload(props);
    }
    return props.eventView.getEventsAPIPayload(props.location);
  }

  _shouldRefetchData = (prevProps: Props<T, P>): boolean => {
    const thisAPIPayload = this.getPayload(this.props);
    const otherAPIPayload = this.getPayload(prevProps);

    return (
      !isAPIPayloadSimilar(thisAPIPayload, otherAPIPayload) ||
      prevProps.limit !== this.props.limit ||
      prevProps.route !== this.props.route ||
      prevProps.cursor !== this.props.cursor
    );
  };

  fetchData = () => {
    const {
      api,
      beforeFetch,
      afterFetch,
      eventView,
      orgSlug,
      route,
      limit,
      cursor,
    } = this.props;

    if (!eventView.isValid()) {
      return;
    }

    const url = `/organizations/${orgSlug}/${route}/`;
    const tableFetchID = Symbol(`tableFetchID`);
    const apiPayload: Partial<EventQuery & LocationQuery> = this.getPayload(this.props);

    this.setState({isLoading: true, tableFetchID});

    if (limit) {
      apiPayload.per_page = limit;
    }
    if (cursor) {
      apiPayload.cursor = cursor;
    }

    beforeFetch?.(api);

    api
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

        const tableData = afterFetch ? afterFetch(data, this.props) : data;

        this.setState(prevState => ({
          isLoading: false,
          tableFetchID: undefined,
          error: null,
          pageLinks: jqXHR ? jqXHR.getResponseHeader('Link') : prevState.pageLinks,
          tableData,
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

  render() {
    const {isLoading, error, tableData, pageLinks} = this.state;

    const childrenProps: GenericChildrenProps<T> = {
      isLoading,
      error,
      tableData,
      pageLinks,
    };
    const children: ReactProps<T>['children'] = this.props.children; // Explicitly setting type due to issues with generics and React's children
    return children?.(childrenProps);
  }
}

export default GenericDiscoverQuery;
