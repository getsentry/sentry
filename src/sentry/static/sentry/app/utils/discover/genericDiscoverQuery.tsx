import React from 'react';
import {Location} from 'history';

import {EventQuery} from 'app/actionCreators/events';
import {Client} from 'app/api';
import {t} from 'app/locale';
import EventView, {
  isAPIPayloadSimilar,
  LocationQuery,
} from 'app/utils/discover/eventView';

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
  /**
   * Include this whenever pagination won't be used. Limit can still be used when this is
   * passed, but cursor will be ignored.
   */
  noPagination?: boolean;
  /**
   * A callback to set an error so that the error can be rendered in parent components
   */
  setError?: (msg: string | undefined) => void;
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

  fetchData = async () => {
    const {
      api,
      beforeFetch,
      afterFetch,
      eventView,
      orgSlug,
      route,
      limit,
      cursor,
      setError,
      noPagination,
    } = this.props;

    if (!eventView.isValid()) {
      return;
    }

    const url = `/organizations/${orgSlug}/${route}/`;
    const tableFetchID = Symbol(`tableFetchID`);
    const apiPayload: Partial<EventQuery & LocationQuery> = this.getPayload(this.props);

    this.setState({isLoading: true, tableFetchID});

    setError?.(undefined);

    if (limit) {
      apiPayload.per_page = limit;
    }
    if (noPagination) {
      apiPayload.noPagination = noPagination;
    }
    if (cursor) {
      apiPayload.cursor = cursor;
    }

    beforeFetch?.(api);

    try {
      const [data, , jqXHR] = await doDiscoverQuery<T>(api, url, apiPayload);
      if (this.state.tableFetchID !== tableFetchID) {
        // invariant: a different request was initiated after this request
        return;
      }

      const tableData = afterFetch ? afterFetch(data, this.props) : data;

      this.setState(prevState => ({
        isLoading: false,
        tableFetchID: undefined,
        error: null,
        pageLinks: jqXHR?.getResponseHeader('Link') ?? prevState.pageLinks,
        tableData,
      }));
    } catch (err) {
      const error = err?.responseJSON?.detail || t('An unknown error occurred.');
      this.setState({
        isLoading: false,
        tableFetchID: undefined,
        error,
        tableData: null,
      });
      if (setError) {
        setError(error);
      }
    }
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

export type DiscoverQueryRequestParams = Partial<EventQuery & LocationQuery>;

export async function doDiscoverQuery<T>(
  api: Client,
  url: string,
  params: DiscoverQueryRequestParams
): Promise<[T, string | undefined, JQueryXHR | undefined]> {
  return api.requestPromise(url, {
    method: 'GET',
    includeAllArgs: true,
    query: {
      // marking params as any so as to not cause typescript errors
      ...(params as any),
    },
  });
}

export default GenericDiscoverQuery;
