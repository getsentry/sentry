import React, {useEffect, useState} from 'react';
import * as Sentry from '@sentry/react';

import {ResponseMeta} from 'sentry/api';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {metric} from 'sentry/utils/analytics';
import getRouteStringFromRoutes from 'sentry/utils/getRouteStringFromRoutes';
import useApi from 'sentry/utils/useApi';
import useLocation from 'sentry/utils/useLocation';
import useParams from 'sentry/utils/useParams';
import useRoutes from 'sentry/utils/useRoutes';
import PermissionDenied from 'sentry/views/permissionDenied';
import RouteError from 'sentry/views/routeError';

type State = {
  data: {[key: string]: any};

  errors: {[key: string]: ResponseMeta};
  hasError: boolean;
  /**
   * This is state for when fetching data from API
   */
  isLoading: boolean;
  isReloading: boolean;
  remainingRequests?: number;

  /**
   * Indicates that Team results (from API) are paginated and there are more
   * Teams that are not in the initial response.
   */
};

type Result = {
  renderComponent: (_child: React.ReactNode) => React.ReactNode;
} & State;

type Options = {
  disableErrorReport: boolean;
  reloadOnVisible: boolean;
  shouldReload: boolean;
  shouldReloadOnVisible: boolean;
  shouldRenderBadRequests: boolean;
};

type Props = {
  endpoints: Array<[string, string, any?, any?]>;
  onLoadAllEndpointsSuccess?: () => void;
  onRequestError?: (_err, _args) => void;
  onRequestSuccess?: (_data) => void;
  options?: Options;
};

type MetricsState = {
  error: boolean;
  finished: boolean;
  hasMeasured: boolean;
};

function useAsync({
  endpoints = [],
  options = {
    reloadOnVisible: false,
    shouldReloadOnVisible: false,
    shouldReload: false,
    shouldRenderBadRequests: false,
    disableErrorReport: true,
  },
  onLoadAllEndpointsSuccess = () => {},
  onRequestSuccess = _data => {},
  onRequestError = (_err, _args) => {},
}: Props): Result {
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
  };
  const [state, setState] = useState<State>({...initialState});

  useEffect(() => {
    const mount = async () => {
      await fetchData();
    };
    if (routes && routes.length) {
      metric.mark({name: `async-component-${getRouteStringFromRoutes(routes)}`});
    }

    if (options.reloadOnVisible) {
      document.addEventListener('visibilitychange', visibilityReloader);
    }

    mount();

    return () => {
      // Anything in here is fired on component unmount.
      api.clear();
      document.removeEventListener('visibilitychange', visibilityReloader);
    };
  }, []);

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
  }, [measurement]);

  useEffect(() => {
    remountComponent();
  }, [location.search, location.state, params]);

  useEffect(() => {
    if (endpoints.length && state.remainingRequests === 0 && !state.hasError) {
      onLoadAllEndpointsSuccess();
    }
  }, [state]);

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
    if (options.shouldReload) {
      return async () => {
        await reloadData();
      };
    }
    setState({...initialState});
    return async () => {
      await fetchData();
    };
  }

  function visibilityReloader() {
    return (
      options.shouldReloadOnVisible &&
      !state.isLoading &&
      !document.hidden &&
      reloadData()
    );
  }

  async function reloadData() {
    return fetchData({reloading: true});
  }

  function handleRequestSuccess({stateKey, data, resp}, initialRequest?: boolean) {
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

  function handleError(error, args) {
    const [stateKey] = args;
    if (error && error.responseText) {
      Sentry.addBreadcrumb({
        message: error.responseText,
        category: 'xhr',
        level: Sentry.Severity.Error,
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
      setState({...state, isLoading: false, hasError: false});
      return;
    }

    // Cancel any in flight requests
    api.clear();

    setState({
      ...state,
      isLoading: true,
      hasError: false,
      remainingRequests: endpoints.length,
      ...extraState,
    });

    await Promise.all(
      endpoints.map(async ([stateKey, endpoint, parameters, opts]) => {
        opts = opts || {};
        // If you're using nested async components/views make sure to pass the
        // props through so that the child component has access to props.location
        const locationQuery = (location && location.query) || {};
        let query = (parameters && parameters.query) || {};
        // If paginate option then pass entire `query` object to API call
        // It should only be expecting `query.cursor` for pagination
        if ((opts.paginate || locationQuery.cursor) && !opts.disableEntireQuery) {
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
          handleError(error, [stateKey, endpoint, parameters, opts]);
        }
      })
    );
  }

  function shouldRenderLoading() {
    return state.isLoading && (!options.shouldReload || !state.isReloading);
  }

  function renderLoading() {
    return <LoadingIndicator />;
  }

  function renderError(error?: Error, disableLog = false): React.ReactNode {
    const {errors} = state;

    // 401s are captured by SudoModal, but may be passed back to AsyncComponent if they close the modal without identifying
    const unauthorizedErrors = Object.values(errors).find(resp => resp?.status === 401);

    // Look through endpoint results to see if we had any 403s, means their role can not access resource
    const permissionErrors = Object.values(errors).find(resp => resp?.status === 403);

    // If all error responses have status code === 0, then show error message but don't
    // log it to sentry
    const shouldLogSentry =
      !!Object.values(errors).find(resp => resp?.status !== 0) || disableLog;

    if (unauthorizedErrors) {
      return (
        <LoadingError message={t('You are not authorized to access this resource.')} />
      );
    }

    if (permissionErrors) {
      return <PermissionDenied />;
    }

    if (options.shouldRenderBadRequests) {
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
        disableReport={options.disableErrorReport}
      />
    );
  }

  function renderBody(elem: React.ReactNode) {
    // Allow children to implement this
    return elem;
  }

  function renderComponent(elem: React.ReactNode) {
    return shouldRenderLoading()
      ? renderLoading()
      : state.hasError
      ? renderError(new Error('Unable to load all required endpoints'))
      : renderBody(elem);
  }

  return {
    ...state,
    renderComponent,
  };
}

export default useAsync;
