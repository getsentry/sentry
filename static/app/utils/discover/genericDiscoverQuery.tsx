import {useLayoutEffect, useRef, useState} from 'react';
import {useQuery, type UseQueryOptions} from '@tanstack/react-query';
import type {Location} from 'history';

import type {EventQuery} from 'sentry/actionCreators/events';
import {Client} from 'sentry/api';
import {t} from 'sentry/locale';
import type {ResponseMeta} from 'sentry/types/api';
import {useApi} from 'sentry/utils/useApi';

import type {EventView, ImmutableEventView, LocationQuery} from './eventView';
import {isAPIPayloadSimilar} from './eventView';

interface DiscoverQueryExtras {
  useOnDemandMetrics?: boolean;
}

interface _DiscoverQueryExtras {
  queryExtras?: DiscoverQueryExtras;
}
export class QueryError extends Error {
  private originalError: any; // For debugging in case parseError picks a value that doesn't make sense.
  constructor(errorMessage: string, originalError?: any) {
    super(errorMessage);
    this.name = 'QueryError';
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
   * Record limit to get.
   */
  limit?: number;
  /**
   * Include this whenever pagination won't be used. Limit can still be used when this is
   * passed, but cursor will be ignored.
   */
  noPagination?: boolean;
  options?: Omit<
    UseQueryOptions<[any, string | undefined, ResponseMeta | undefined], QueryError>,
    'queryKey' | 'queryFn'
  > & {additionalQueryKey?: UseQueryOptions['queryKey']};
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

export type DiscoverQueryProps = BaseDiscoverQueryProps & {
  eventView: EventView | ImmutableEventView;
  orgSlug: string;
};

type ReactProps<T> = {
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

type Props<T, P> = DiscoverQueryProps & P & ReactProps<T> & ComponentProps<T, P>;

function shouldRefetch<T, P>(prevProps: Props<T, P>, props: Props<T, P>): boolean {
  const payloadChanged =
    !isAPIPayloadSimilar(getPayload(props), getPayload(prevProps)) ||
    prevProps.limit !== props.limit ||
    prevProps.route !== props.route ||
    prevProps.cursor !== props.cursor;

  const becameValid = !prevProps.eventView.isValid() && props.eventView.isValid();

  return (
    payloadChanged ||
    becameValid ||
    (props.shouldRefetchData?.(prevProps, props) ?? false)
  );
}

/**
 * Generic component for discover queries
 */
export function GenericDiscoverQuery<T, P>(props: Props<T, P>) {
  const [api] = useState(() => new Client());
  const [state, setState] = useState<GenericChildrenProps<T>>({
    isLoading: true,
    error: null,
    tableData: null,
    pageLinks: null,
  });
  const latestPropsRef = useRef(props);
  const prevPropsRef = useRef<Props<T, P> | undefined>(undefined);
  const tableFetchIDRef = useRef<symbol | undefined>(undefined);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- runs after every render to compare against the previous props, like componentDidUpdate
  useLayoutEffect(() => {
    latestPropsRef.current = props;
    const prevProps = prevPropsRef.current;
    prevPropsRef.current = props;

    if (prevProps && !shouldRefetch(prevProps, props)) {
      return;
    }

    const {beforeFetch, afterFetch, didFetch, eventView, orgSlug, route, setError} =
      props;

    if (!eventView.isValid()) {
      return;
    }

    const url = `/organizations/${orgSlug}/${route}/`;
    const tableFetchID = Symbol('tableFetchID');
    const apiPayload: Partial<EventQuery & LocationQuery> = getPayload(props);

    tableFetchIDRef.current = tableFetchID;
    setState(prevState => ({...prevState, isLoading: true}));

    setError?.(undefined);

    beforeFetch?.(api);

    // clear any inflight requests since they are now stale
    api.clear();

    const fetchData = async () => {
      try {
        const [data, , resp] = await doDiscoverQuery<T>(api, url, apiPayload);

        if (tableFetchIDRef.current !== tableFetchID) {
          // invariant: a different request was initiated after this request
          return;
        }

        const tableData = afterFetch ? afterFetch(data, latestPropsRef.current) : data;
        didFetch?.(tableData);
        setState(prevState => ({
          isLoading: false,
          error: null,
          pageLinks: resp?.getResponseHeader('Link') ?? prevState.pageLinks,
          tableData,
        }));
      } catch (err) {
        const error = (latestPropsRef.current.parseError ?? parseError)(err);
        setState(prevState => ({...prevState, isLoading: false, error, tableData: null}));
        setError?.(error ?? undefined);
      }
    };

    fetchData();
  });

  return props.children?.(state);
}

export type DiscoverQueryRequestParams = Partial<
  EventQuery & LocationQuery & _DiscoverQueryExtras
>;

export async function doDiscoverQuery<T>(
  api: Client,
  url: string,
  params: DiscoverQueryRequestParams,
  options: {
    skipAbort?: boolean;
  } = {}
): Promise<[T, string | undefined, ResponseMeta<T> | undefined]> {
  const {skipAbort} = options;

  return api.requestPromise(url, {
    method: 'GET',
    includeAllArgs: true,
    query: {
      // marking params as any so as to not cause typescript errors
      ...(params as any),
    },
    skipAbort,
  });
}

function getPayload<T, P>(props: Props<T, P>) {
  const {cursor, limit, noPagination, referrer, getRequestPayload, eventView, location} =
    props;
  const payload = getRequestPayload
    ? getRequestPayload(props)
    : eventView.getEventsAPIPayload(location);

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
  const additionalQueryKey = props.options?.additionalQueryKey ?? [];

  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  const res = useQuery<[T, string | undefined, ResponseMeta<T> | undefined], QueryError>({
    queryKey: [...additionalQueryKey, route, apiPayload],
    queryFn: ({signal: _signal}) =>
      doDiscoverQuery<T>(api, url, apiPayload, {
        skipAbort: props.skipAbort,
      }),
    ...options,
  });

  return {
    // eslint-disable-next-line @tanstack/query/no-rest-destructuring
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

export function getQueryErrorMessage(error: unknown): string | undefined {
  if (!error || typeof error !== 'object' || !('message' in error)) {
    return undefined;
  }

  const {message} = error;
  if (typeof message !== 'string') {
    return undefined;
  }

  const trimmed = message.trim();
  if (!trimmed || trimmed === t('An unknown error occurred.')) {
    return undefined;
  }

  return trimmed;
}
