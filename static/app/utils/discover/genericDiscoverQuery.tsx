import {Component, useContext} from 'react';
import {useQuery} from '@tanstack/react-query';
import type {Location} from 'history';

import type {EventQuery} from 'sentry/actionCreators/events';
import type {ResponseMeta} from 'sentry/api';
import {Client} from 'sentry/api';
import {t} from 'sentry/locale';
import type {ImmutableEventView, LocationQuery} from 'sentry/utils/discover/eventView';
import type EventView from 'sentry/utils/discover/eventView';
import {isAPIPayloadSimilar} from 'sentry/utils/discover/eventView';
import type {QueryBatching} from 'sentry/utils/performance/contexts/genericQueryBatcher';
import {PerformanceEventViewContext} from 'sentry/utils/performance/contexts/performanceEventViewContext';
import type {UseQueryOptions} from 'sentry/utils/queryClient';

import useApi from '../useApi';
import useOrganization from '../useOrganization';

export interface DiscoverQueryExtras {
  useOnDemandMetrics?: boolean;
}

interface _DiscoverQueryExtras {
  queryExtras?: DiscoverQueryExtras;
}
export class QueryError extends Error {
  message: string;
  private originalError: any; // For debugging in case parseError picks a value that doesn't make sense.
  constructor(errorMessage: string, originalError?: any) {
    super(errorMessage);

    this.message = errorMessage;
    this.originalError = originalError;
  }

  getOriginalError() {
    return this.originalError;
  }
}

export type GenericChildrenProps<T> = {
  /**
   * Error, if not null.
   */
  error: null | QueryError;
  /**
   * Loading state of this query.
   */
  isLoading: boolean;
  /**
   * Pagelinks, if applicable. Can be provided to the Pagination component.
   */
  pageLinks: null | string;
  /**
   * Data / result.
   */
  tableData: T | null;
};

type OptionalContextProps = {
  eventView?: EventView | ImmutableEventView;
  orgSlug?: string;
};

type BaseDiscoverQueryProps = {
  /**
   * Used as the default source for cursor values.
   */
  location: Location;
  /**
   * Explicit cursor value if you aren't using `location.query.cursor` because there are
   * multiple paginated results on the page.
   */
  cursor?: string;
  /**
   * Appends a raw string to query to be able to sidestep the tokenizer.
   * @deprecated
   */
  forceAppendRawQueryString?: string;
  /**
   * Record limit to get.
   */
  limit?: number;
  /**
   * Include this whenever pagination won't be used. Limit can still be used when this is
   * passed, but cursor will be ignored.
   */
  noPagination?: boolean;
  options?: Omit<
    UseQueryOptions<[any, string | undefined, ResponseMeta<any> | undefined], QueryError>,
    'queryKey' | 'queryFn'
  >;
  /**
   * A container for query batching data and functions.
   */
  queryBatching?: QueryBatching;
  /**
   * Extra query parameters to be added.
   */
  queryExtras?: Record<string, string | string[] | undefined>;
  /**
   * Sets referrer parameter in the API Payload. Set of allowed referrers are defined
   * on the OrganizationDiscoverEndpoint view.
   */
  referrer?: string;
  /**
   * A callback to set an error so that the error can be rendered in parent components
   */
  setError?: (errObject: QueryError | undefined) => void;
  /**
   * A flag to skip aborting the request when api.clear() is called, which happens
   * frequently on component unmounts.
   */
  skipAbort?: boolean;
};

export type DiscoverQueryPropsWithContext = BaseDiscoverQueryProps & OptionalContextProps;
export type DiscoverQueryProps = BaseDiscoverQueryProps & {
  eventView: EventView | ImmutableEventView;
  orgSlug: string;
};

type InnerRequestProps<P> = DiscoverQueryProps & P;
type OuterRequestProps<P> = DiscoverQueryPropsWithContext & P;

export type ReactProps<T> = {
  children?: (props: GenericChildrenProps<T>) => React.ReactNode;
};

type ComponentProps<T, P> = {
  /**
   * Route to the endpoint
   */
  route: string;
  /**
   * A hook to modify data into the correct output after data has been received
   */
  afterFetch?: (data: any, props?: Props<T, P>) => T;
  /**
   * A hook before fetch that can be used to do things like clearing the api
   */
  beforeFetch?: (api: Client) => void;
  /**
   * A hook for parent orchestrators to pass down data based on query results, unlike afterFetch it is not meant for specializations as it will not modify data.
   */
  didFetch?: (data: T) => void;
  /**
   * Allows components to modify the payload before it is set.
   */
  getRequestPayload?: (props: Props<T, P>) => any;
  options?: BaseDiscoverQueryProps['options'];
  /**
   * An external hook to parse errors in case there are differences for a specific api.
   */
  parseError?: (error: any) => QueryError | null;
  /**
   * An external hook in addition to the event view check to check if data should be refetched
   */
  shouldRefetchData?: (prevProps: Props<T, P>, props: Props<T, P>) => boolean;
};

type Props<T, P> = InnerRequestProps<P> & ReactProps<T> & ComponentProps<T, P>;
type OuterProps<T, P> = OuterRequestProps<P> & ReactProps<T> & ComponentProps<T, P>;

type State<T> = {
  api: Client;
  tableFetchID: symbol | undefined;
} & GenericChildrenProps<T>;

/**
 * Generic component for discover queries
 */
class _GenericDiscoverQuery<T, P> extends Component<Props<T, P>, State<T>> {
  state: State<T> = {
    isLoading: true,
    tableFetchID: undefined,
    error: null,

    tableData: null,
    pageLinks: null,
    api: new Client(),
  };

  componentDidMount() {
    this.fetchData();
  }

  componentDidUpdate(prevProps: Props<T, P>) {
    // Reload data if the payload changes
    const refetchCondition = this._shouldRefetchData(prevProps);

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

  _shouldRefetchData = (prevProps: Props<T, P>): boolean => {
    const thisAPIPayload = getPayload(this.props);
    const otherAPIPayload = getPayload(prevProps);

    return (
      !isAPIPayloadSimilar(thisAPIPayload, otherAPIPayload) ||
      prevProps.limit !== this.props.limit ||
      prevProps.route !== this.props.route ||
      prevProps.cursor !== this.props.cursor
    );
  };

  /**
   * The error type isn't consistent across APIs. We see detail as just string some times, other times as an object.
   */
  _parseError = (error: any): QueryError | null => {
    if (this.props.parseError) {
      return this.props.parseError(error);
    }

    return parseError(error);
  };

  fetchData = async () => {
    const {
      queryBatching,
      beforeFetch,
      afterFetch,
      didFetch,
      eventView,
      orgSlug,
      route,
      setError,
    } = this.props;
    const {api} = this.state;

    if (!eventView.isValid()) {
      return;
    }

    const url = `/organizations/${orgSlug}/${route}/`;
    const tableFetchID = Symbol(`tableFetchID`);
    const apiPayload: Partial<EventQuery & LocationQuery> = getPayload(this.props);

    this.setState({isLoading: true, tableFetchID});

    setError?.(undefined);

    beforeFetch?.(api);

    // clear any inflight requests since they are now stale
    api.clear();

    try {
      const [data, , resp] = await doDiscoverQuery<T>(api, url, apiPayload, {
        queryBatching,
      });

      if (this.state.tableFetchID !== tableFetchID) {
        // invariant: a different request was initiated after this request
        return;
      }

      const tableData = afterFetch ? afterFetch(data, this.props) : data;
      didFetch?.(tableData);
      this.setState(prevState => ({
        isLoading: false,
        tableFetchID: undefined,
        error: null,
        pageLinks: resp?.getResponseHeader('Link') ?? prevState.pageLinks,
        tableData,
      }));
    } catch (err) {
      const error = this._parseError(err);
      this.setState({
        isLoading: false,
        tableFetchID: undefined,
        error,
        tableData: null,
      });
      if (setError) {
        setError(error ?? undefined);
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

// Shim to allow us to use generic discover query or any specialization with or without passing org slug or eventview, which are now contexts.
// This will help keep tests working and we can remove extra uses of context-provided props and update tests as we go.
export function GenericDiscoverQuery<T, P>(props: OuterProps<T, P>) {
  const organizationSlug = useOrganization({allowNull: true})?.slug;
  const performanceEventView = useContext(PerformanceEventViewContext)?.eventView;

  const orgSlug = props.orgSlug ?? organizationSlug;
  const eventView = props.eventView ?? performanceEventView;

  if (orgSlug === undefined || eventView === undefined) {
    throw new Error('GenericDiscoverQuery requires both an orgSlug and eventView');
  }

  const _props: Props<T, P> = {
    ...props,
    orgSlug,
    eventView,
  };
  // TODO(any): HoC prop types not working w/ emotion https://github.com/emotion-js/emotion/issues/3261
  return <_GenericDiscoverQuery<T, P> {...(_props as any)} />;
}

export type DiscoverQueryRequestParams = Partial<
  EventQuery & LocationQuery & _DiscoverQueryExtras
>;

type RetryOptions = {
  statusCodes: number[];
  tries: number;
  baseTimeout?: number;
  timeoutMultiplier?: number;
};

const BASE_TIMEOUT = 200;
const TIMEOUT_MULTIPLIER = 2;
const wait = (duration: any) => new Promise(resolve => setTimeout(resolve, duration));

export async function doDiscoverQuery<T>(
  api: Client,
  url: string,
  params: DiscoverQueryRequestParams,
  options: {
    queryBatching?: QueryBatching;
    retry?: RetryOptions;
    skipAbort?: boolean;
  } = {}
): Promise<[T, string | undefined, ResponseMeta<T> | undefined]> {
  const {queryBatching, retry, skipAbort} = options;
  if (queryBatching?.batchRequest) {
    return queryBatching.batchRequest(api, url, {
      query: params,
      includeAllArgs: true,
    });
  }

  const baseTimeout = retry?.baseTimeout ?? BASE_TIMEOUT;
  const timeoutMultiplier = retry?.timeoutMultiplier ?? TIMEOUT_MULTIPLIER;
  const statusCodes = retry?.statusCodes ?? [];
  const maxTries = retry?.tries ?? 1;
  let tries = 0;
  let timeout = 0;
  let error: any;

  while (tries < maxTries && (!error || statusCodes.includes(error.status))) {
    if (timeout > 0) {
      await wait(timeout);
    }
    try {
      tries++;
      return await api.requestPromise(url, {
        method: 'GET',
        includeAllArgs: true,
        query: {
          // marking params as any so as to not cause typescript errors
          ...(params as any),
        },
        skipAbort,
      });
    } catch (err) {
      error = err;
      timeout = baseTimeout * timeoutMultiplier ** (tries - 1);
    }
  }
  throw error;
}

function getPayload<T, P>(props: Props<T, P>) {
  const {
    cursor,
    limit,
    noPagination,
    referrer,
    getRequestPayload,
    eventView,
    location,
    forceAppendRawQueryString,
  } = props;
  const payload = getRequestPayload
    ? getRequestPayload(props)
    : eventView.getEventsAPIPayload(location, forceAppendRawQueryString);

  if (cursor !== undefined) {
    payload.cursor = cursor;
  }
  if (limit) {
    payload.per_page = limit;
  }
  if (noPagination) {
    payload.noPagination = noPagination;
  }
  if (referrer) {
    payload.referrer = referrer;
  }

  Object.assign(payload, props.queryExtras ?? {});

  return payload;
}

export function useGenericDiscoverQuery<T, P>(props: Props<T, P>) {
  const api = useApi();
  const {orgSlug, route, options} = props;
  const url = `/organizations/${orgSlug}/${route}/`;
  const apiPayload = getPayload<T, P>(props);

  const res = useQuery<[T, string | undefined, ResponseMeta<T> | undefined], QueryError>({
    // eslint-disable-next-line @tanstack/query/exhaustive-deps
    queryKey: [route, apiPayload],
    queryFn: ({signal: _signal}) =>
      doDiscoverQuery<T>(api, url, apiPayload, {
        queryBatching: props.queryBatching,
        skipAbort: props.skipAbort,
      }),
    ...options,
  });

  return {
    ...res,
    data: res.data?.[0] ?? undefined,
    error: parseError(res.error),
    statusCode: res.data?.[1] ?? undefined,
    response: res.data?.[2] ?? undefined,
  };
}

export const parseError = (error: any): QueryError | null => {
  if (!error) {
    return null;
  }

  const detail = error.responseJSON?.detail;
  if (typeof detail === 'string') {
    return new QueryError(detail, error);
  }

  const message = detail?.message;
  if (typeof message === 'string') {
    return new QueryError(message, error);
  }

  return new QueryError(t('An unknown error occurred.'), error);
};

export default GenericDiscoverQuery;
