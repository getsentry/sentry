import {useEffect, useState} from 'react';
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

type State = {
  /**
   * Mapping of results from the configured endpoints
   */
  data: {[key: string]: any};
  /**
   * Errors from the configured endpoionts
   */
  errors: {[key: string]: RequestError};
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
};

type Result = State & {
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
};

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

type EndpointDefinition = [
  key: string,
  url: string,
  urlOptions?: {query?: string},
  requestOptions?: EndpointRequestOptions
];

type Options = {
  endpoints: EndpointDefinition[];
  /**
   * If a request fails and is not a bad request, and if `disableErrorReport`
   * is set to false, the UI will display an error modal.
   *
   * It is recommended to enable this property ideally only when the subclass
   * is used by a top level route.
   */
  disableErrorReport?: boolean;
  onLoadAllEndpointsSuccess?: () => void;
  onRequestError?: (error: RequestError, args: Options['endpoints'][0]) => void;
  onRequestSuccess?: (data: {data: any; stateKey: string; resp?: ResponseMeta}) => void;
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
   * When enabling reloadOnVisible, this flag may be used to turn on and off
   * the reloading. This is useful if your component only needs to reload when
   * becoming visible during certain states.
   *
   * eslint-disable-next-line react/sort-comp
   */
  shouldReloadOnVisible?: boolean;
  /**
   * should `renderError` render the `detail` attribute of a 400 error
   */
  shouldRenderBadRequests?: boolean;
};

type MetricsState = {
  error: boolean;
  finished: boolean;
  hasMeasured: boolean;
};

function renderLoading() {
  return <LoadingIndicator />;
}

function useApiRequests({
  endpoints = [],
  reloadOnVisible = false,
  shouldReloadOnVisible = false,
  shouldReload = false,
  shouldRenderBadRequests = false,
  disableErrorReport = true,
  onLoadAllEndpointsSuccess = () => {},
  onRequestSuccess = _data => {},
  onRequestError = (_error, _args) => {},
}: Options): Result {
  const api = useApi();
  const location = useLocation();
  const routes = useRoutes();
  const params = useParams();

  const [measurement, setMeasurement] = useState<MetricsState>({
    hasMeasured: false,
    finished: false,
    error: false,
  });

  const initialState = {
    data: {},
    isLoading: false,
    hasError: false,
    isReloading: false,
    errors: {},
    remainingRequests: endpoints.length,
  };
  const [state, setState] = useState<State>({...initialState});

  useEffect(() => {
    const mount = async () => {
      try {
        await fetchData();
      } catch (error) {
        setState(prevState => ({...prevState, hasError: true}));
        throw error;
      }
    };
    if (routes && routes.length) {
      metric.mark({name: `async-component-${getRouteStringFromRoutes(routes)}`});
    }

    if (reloadOnVisible) {
      document.addEventListener('visibilitychange', visibilityReloader);
    }

    mount();

    return () => {
      // Anything in here is fired on component unmount.
      api.clear();
      document.removeEventListener('visibilitychange', visibilityReloader);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Take a measurement from when this component is initially created until it finishes it's first
    // set of API requests
    if (!measurement.hasMeasured && measurement.finished && routes) {
      const routeString = getRouteStringFromRoutes(routes);
      metric.measure({
        name: 'app.component.async-component',
        start: `async-component-${routeString}`,
        data: {
          route: routeString,
          error: measurement.error,
        },
      });
      setMeasurement({...measurement, hasMeasured: true});
    }
  }, [measurement, routes]);

  useEffect(() => void remountComponent(), [location.search, location.state, params]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (endpoints.length && state.remainingRequests === 0 && !state.hasError) {
      onLoadAllEndpointsSuccess();
    }
  }, [state.remainingRequests, state.hasError, endpoints.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Check if we should measure render time for this component
  function markShouldMeasure({
    remainingRequests,
    error,
  }: {error?: boolean; remainingRequests?: number} = {}) {
    if (measurement.hasMeasured) {
      setMeasurement({
        ...measurement,
        finished: remainingRequests === 0,
        error: error || measurement.error,
      });
    }
  }

  function remountComponent() {
    if (shouldReload) {
      return reloadData();
    }
    setState({...initialState});
    return fetchData();
  }

  function visibilityReloader() {
    return shouldReloadOnVisible && !state.isLoading && !document.hidden && reloadData();
  }

  function reloadData() {
    return fetchData({reloading: true});
  }

  function handleRequestSuccess(
    {stateKey, data, resp}: {data: any; stateKey: string; resp?: ResponseMeta},
    initialRequest?: boolean
  ) {
    setState(prevState => {
      const newState = {
        ...prevState,
        data: {
          ...prevState.data,
          [stateKey]: data,
          [`${stateKey}PageLinks`]: resp?.getResponseHeader('Link'),
        },
      };

      if (initialRequest) {
        newState.remainingRequests = prevState.remainingRequests! - 1;
        newState.isLoading = prevState.remainingRequests! > 1;
        newState.isReloading = prevState.isReloading && newState.isLoading;
        markShouldMeasure({remainingRequests: newState.remainingRequests});
      }

      return newState;
    });

    // if everything is loaded and we don't have an error, call the callback
    onRequestSuccess({stateKey, data, resp});
  }

  function handleError(error: RequestError, args: Options['endpoints'][0]) {
    const [stateKey] = args;
    if (error && error.responseText) {
      Sentry.addBreadcrumb({
        message: error.responseText,
        category: 'xhr',
        level: 'error',
      });
    }
    setState(prevState => {
      const isLoading = prevState.remainingRequests! > 1;
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
        remainingRequests: prevState.remainingRequests! - 1,
        isLoading,
        isReloading: prevState.isReloading && isLoading,
      };
      markShouldMeasure({remainingRequests: newState.remainingRequests, error: true});
      return newState;
    });
    onRequestError(error, args);
  }
  async function fetchData(extraState = {}) {
    if (!endpoints.length) {
      setState(prevState => ({
        ...prevState,
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
        options = options || {};
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
  }

  function renderError(error?: Error, disableLog = false): React.ReactElement {
    const {errors} = state;

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
        .map(resp => resp.responseJSON.detail);

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
  }

  const shouldRenderLoading = state.isLoading && (!shouldReload || !state.isReloading);

  function renderComponent(children: React.ReactElement) {
    return shouldRenderLoading
      ? renderLoading()
      : state.hasError
      ? renderError(new Error('Unable to load all required endpoints'))
      : children;
  }

  return {...state, renderComponent};
}

export default useApiRequests;
