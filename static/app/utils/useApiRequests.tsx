import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import * as Sentry from '@sentry/react';

import {ResponseMeta} from 'sentry/api';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {metric} from 'sentry/utils/analytics';
import getRouteStringFromRoutes from 'sentry/utils/getRouteStringFromRoutes';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import {useParams} from 'sentry/utils/useParams';
import {useRoutes} from 'sentry/utils/useRoutes';
import PermissionDenied from 'sentry/views/permissionDenied';
import RouteError from 'sentry/views/routeError';

import RequestError from './requestError/requestError';
import {useEffectAfterFirstRender} from './useEffectAfterFirstRender';

/**
 * Turn {foo: X} into {foo: X, fooPageLinks: string}
 */
type UseApiRequestData<T extends Record<string, any>> = {
  // Keys can be null on error
  [Property in keyof T]: T[Property] | null;
} & {
  // Make request cursors available
  [Property in keyof T as `${Property & string}PageLinks`]: string | null;
};

interface State<T extends Record<string, any>> {
  /**
   * Mapping of results from the configured endpoints
   */
  data: UseApiRequestData<T>;
  /**
   * Errors from the configured endpoionts
   */
  errors: Record<string, RequestError>;
  /**
   * Did *any* of the endpoints fail?
   */
  hasError: boolean;
  /**
   * Are the endpoints currently loading?
   */
  isLoading: boolean;
  /**
   * Are we *reloading* data without the loading state being set to true?
   */
  isReloading: boolean;
  /**
   * How many requests are still pending?
   */
  remainingRequests: number;
}

interface Result<T extends Record<string, any>> extends State<T> {
  /**
   * renderComponent is a helper function that is used to render loading and
   * errors state for you, and will only render your component once all endpoints
   * have resolved.
   *
   * Typically you would use this when returning react for your component.
   *
   *   return renderComponent(
   *     <div>{data.someEndpoint.resultKey}</div>
   *   )
   *
   * The react element will only be rendered once all endpoints have been loaded.
   */
  renderComponent: (children: React.ReactElement) => React.ReactElement;
}

type EndpointRequestOptions = {
  /**
   * Function to check if the error is allowed
   */
  allowError?: (error: any) => void;
  /**
   * Do not pass query parameters to the API
   */
  disableEntireQuery?: boolean;
  /**
   * If set then pass entire `query` object to API call
   */
  paginate?: boolean;
};

export type EndpointDefinition<T extends Record<string, any>> = [
  key: keyof T,
  url: string,
  urlOptions?: {query?: Record<string, string>},
  requestOptions?: EndpointRequestOptions,
];

type Options<T extends Record<string, any>> = {
  endpoints: EndpointDefinition<T>[];
  /**
   * If a request fails and is not a bad request, and if `disableErrorReport`
   * is set to false, the UI will display an error modal.
   *
   * It is recommended to enable this property ideally only when the subclass
   * is used by a top level route.
   */
  disableErrorReport?: boolean;
  onLoadAllEndpointsSuccess?: () => void;
  onRequestError?: (error: RequestError, args: Options<T>['endpoints'][0]) => void;
  onRequestSuccess?: (data: {data: any; stateKey: keyof T; resp?: ResponseMeta}) => void;
  /**
   * Override this flag to have the component reload its state when the window
   * becomes visible again. This will set the loading and reloading state, but
   * will not render a loading state during reloading.
   *
   * eslint-disable-next-line react/sort-comp
   */
  reloadOnVisible?: boolean;
  /**
   * This affects how the component behaves when `remountComponent` is called
   *
   * By default, the component gets put back into a "loading" state when
   * re-fetching data. If this is true, then when we fetch data, the original
   * ready component remains mounted and it will need to handle any additional
   * "reloading" states
   */
  shouldReload?: boolean;
  /**
   * should `renderError` render the `detail` attribute of a 400 error
   */
  shouldRenderBadRequests?: boolean;
};

function renderLoading() {
  return <LoadingIndicator />;
}

function useApiRequests<T extends Record<string, any>>({
  endpoints,
  reloadOnVisible = false,
  shouldReload = false,
  shouldRenderBadRequests = false,
  disableErrorReport = true,
  onLoadAllEndpointsSuccess = () => {},
  onRequestSuccess = _data => {},
  onRequestError = (_error, _args) => {},
}: Options<T>): Result<T> {
  const api = useApi();
  const location = useLocation<any>();
  const params = useParams();

  // Memoize the initialState so we can easily reuse it later
  const initialState = useMemo<State<T>>(
    () => ({
      data: {} as T,
      isLoading: true,
      hasError: false,
      isReloading: false,
      errors: {},
      remainingRequests: endpoints.length,
    }),
    [endpoints.length]
  );

  const [state, setState] = useState<State<T>>(initialState);

  // Begin measuring the use of the hook for the given route
  const triggerMeasurement = useMeasureApiRequests();

  const handleRequestSuccess = useCallback(
    (
      {stateKey, data, resp}: {data: any; stateKey: keyof T; resp?: ResponseMeta},
      initialRequest?: boolean
    ) => {
      setState(prevState => {
        const newState = {
          ...prevState,
          data: {
            ...prevState.data,
            [stateKey]: data,
            [`${stateKey as string}PageLinks`]: resp?.getResponseHeader('Link'),
          },
        };

        if (initialRequest) {
          newState.remainingRequests = prevState.remainingRequests - 1;
          newState.isLoading = prevState.remainingRequests > 1;
          newState.isReloading = prevState.isReloading && newState.isLoading;
          triggerMeasurement({finished: newState.remainingRequests === 0});
        }

        return newState;
      });

      // if everything is loaded and we don't have an error, call the callback
      onRequestSuccess({stateKey, data, resp});
    },
    [onRequestSuccess, triggerMeasurement]
  );

  const handleError = useCallback(
    (error: RequestError, args: EndpointDefinition<T>) => {
      const [stateKey] = args;

      if (error && error.responseText) {
        Sentry.addBreadcrumb({
          message: error.responseText,
          category: 'xhr',
          level: 'error',
        });
      }

      setState(prevState => {
        const isLoading = prevState.remainingRequests > 1;
        const newState = {
          errors: {
            ...prevState.errors,
            [stateKey]: error,
          },
          data: {
            ...prevState.data,
            [stateKey]: null,
          },
          hasError: prevState.hasError || !!error,
          remainingRequests: prevState.remainingRequests - 1,
          isLoading,
          isReloading: prevState.isReloading && isLoading,
        };
        triggerMeasurement({finished: newState.remainingRequests === 0, error: true});
        return newState;
      });

      onRequestError(error, args);
    },
    [triggerMeasurement, onRequestError]
  );

  const fetchData = useCallback(
    async (extraState: Partial<State<T>> = {}) => {
      // Nothing to fetch if endpoints are empty
      if (!endpoints.length) {
        setState(prevState => ({
          ...prevState,
          data: {} as T,
          isLoading: false,
          hasError: false,
        }));

        return;
      }

      // Cancel any in flight requests
      api.clear();

      setState(prevState => ({
        ...prevState,
        isLoading: true,
        hasError: false,
        remainingRequests: endpoints.length,
        ...extraState,
      }));

      await Promise.all(
        endpoints.map(async ([stateKey, endpoint, parameters, options]) => {
          options = options ?? {};
          // If you're using nested async components/views make sure to pass the
          // props through so that the child component has access to props.location
          const locationQuery = (location && location.query) || {};
          let query = (parameters && parameters.query) || {};
          // If paginate option then pass entire `query` object to API call
          // It should only be expecting `query.cursor` for pagination
          if ((options.paginate || locationQuery.cursor) && !options.disableEntireQuery) {
            query = {...locationQuery, ...query};
          }
          try {
            const results = await api.requestPromise(endpoint, {
              method: 'GET',
              ...parameters,
              query,
              includeAllArgs: true,
            });
            const [data, _, resp] = results;
            handleRequestSuccess({stateKey, data, resp}, true);
          } catch (error) {
            handleError(error, [stateKey, endpoint, parameters, options]);
          }
        })
      );
    },
    [api, endpoints, handleError, handleRequestSuccess, location]
  );
  const reloadData = useCallback(() => fetchData({isReloading: true}), [fetchData]);

  const handleMount = useCallback(async () => {
    try {
      await fetchData();
    } catch (error) {
      setState(prevState => ({...prevState, hasError: true}));
      throw error;
    }
  }, [fetchData]);

  // Trigger fetch on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => void handleMount(), []);

  const handleFullReload = useCallback(() => {
    if (shouldReload) {
      return reloadData();
    }
    setState({...initialState});
    return fetchData();
  }, [initialState, reloadData, fetchData, shouldReload]);

  // Trigger fetch on location or parameter change
  // useEffectAfterFirstRender to avoid calling at the same time as handleMount
  useEffectAfterFirstRender(
    () => void handleFullReload(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [location?.search, location?.state, params]
  );

  const visibilityReloader = useCallback(
    () => !state.isLoading && !document.hidden && reloadData(),
    [state.isLoading, reloadData]
  );

  // Trigger fetch on visible change when using visibilityReloader
  useEffect(() => {
    if (reloadOnVisible) {
      document.addEventListener('visibilitychange', visibilityReloader);
    }

    return () => document.removeEventListener('visibilitychange', visibilityReloader);
  }, [reloadOnVisible, visibilityReloader]);

  // Trigger onLoadAllEndpointsSuccess when everything has been loaded
  useEffect(
    () => {
      if (endpoints.length && state.remainingRequests === 0 && !state.hasError) {
        onLoadAllEndpointsSuccess();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.remainingRequests, state.hasError, endpoints.length]
  );

  const renderError = useCallback(
    (error?: Error, disableLog = false): React.ReactElement => {
      const errors = state.errors;

      // 401s are captured by SudoModal, but may be passed back to AsyncComponent
      // if they close the modal without identifying
      const unauthorizedErrors = Object.values(errors).some(resp => resp?.status === 401);

      // Look through endpoint results to see if we had any 403s, means their
      // role can not access resource
      const permissionErrors = Object.values(errors).some(resp => resp?.status === 403);

      // If all error responses have status code === 0, then show error message
      // but don't log it to sentry
      const shouldLogSentry =
        !!Object.values(errors).some(resp => resp?.status !== 0) || disableLog;

      if (unauthorizedErrors) {
        return (
          <LoadingError message={t('You are not authorized to access this resource.')} />
        );
      }

      if (permissionErrors) {
        return <PermissionDenied />;
      }

      if (shouldRenderBadRequests) {
        const badRequests = Object.values(errors)
          .filter(resp => resp?.status === 400 && resp?.responseJSON?.detail)
          .map(resp => resp.responseJSON?.detail);

        if (badRequests.length) {
          return <LoadingError message={[...new Set(badRequests)].join('\n')} />;
        }
      }

      return (
        <RouteError
          error={error}
          disableLogSentry={!shouldLogSentry}
          disableReport={disableErrorReport}
        />
      );
    },
    [state.errors, disableErrorReport, shouldRenderBadRequests]
  );

  const shouldRenderLoading = state.isLoading && (!shouldReload || !state.isReloading);

  const renderComponent = useCallback(
    (children: React.ReactElement) =>
      shouldRenderLoading ? renderLoading() : state.hasError ? renderError() : children,
    [shouldRenderLoading, state.hasError, renderError]
  );

  return {...state, renderComponent};
}

export default useApiRequests;

type MetricsState = {
  error: boolean;
  finished: boolean;
  hasMeasured: boolean;
};

type MetricUpdate = Partial<Pick<MetricsState, 'finished' | 'error'>>;

/**
 * Helper hook that marks a measurement when the component mounts.
 *
 * Use the `triggerMeasurement` function to trigger a measurement when the
 * useApiRequests hook has finished loading all requests. Will only trigger once
 */
function useMeasureApiRequests() {
  const routes = useRoutes();

  const measurement = useRef<MetricsState>({
    hasMeasured: false,
    finished: false,
    error: false,
  });

  // Start measuring immediately upon mount. We re-mark if the route list has
  // changed, since the component is now being used under a different route
  useEffect(() => {
    // Reset the measurement object
    measurement.current = {
      hasMeasured: false,
      finished: false,
      error: false,
    };

    if (routes && routes.length) {
      metric.mark({name: `async-component-${getRouteStringFromRoutes(routes)}`});
    }
  }, [routes]);

  const triggerMeasurement = useCallback(
    ({finished, error}: MetricUpdate) => {
      if (!routes) {
        return;
      }

      if (finished) {
        measurement.current.finished = true;
      }

      if (error) {
        measurement.current.error = true;
      }

      if (!measurement.current.hasMeasured && measurement.current.finished) {
        const routeString = getRouteStringFromRoutes(routes);
        metric.measure({
          name: 'app.component.async-component',
          start: `async-component-${routeString}`,
          data: {
            route: routeString,
            error: measurement.current.error,
          },
        });

        measurement.current.hasMeasured = true;
      }
    },
    [routes]
  );

  return triggerMeasurement;
}
