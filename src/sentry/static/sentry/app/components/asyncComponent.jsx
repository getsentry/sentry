import {isEqual} from 'lodash';
import PropTypes from 'prop-types';
import React from 'react';
import * as Sentry from '@sentry/browser';

import {Client} from 'app/api';
import {t} from 'app/locale';
import AsyncComponentSearchInput from 'app/components/asyncComponentSearchInput';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import PermissionDenied from 'app/views/permissionDenied';
import RouteError from 'app/views/routeError';

export default class AsyncComponent extends React.Component {
  static propTypes = {
    location: PropTypes.object,
  };

  static contextTypes = {
    router: PropTypes.object,
  };

  static errorHandler(component, fn) {
    return (...args) => {
      try {
        return fn(...args);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(error);
        setTimeout(() => {
          throw error;
        });
        component.setState({error});
        return null;
      }
    };
  }

  // Override this flag to have the component reload it's state when the window
  // becomes visible again. This will set the loading and reloading state, but
  // will not render a loading state during reloading.
  //
  // eslint-disable-next-line react/sort-comp
  reloadOnVisible = false;

  // When enabling reloadOnVisible, this flag may be used to turn on and off
  // the reloading. This is useful if your component only needs to reload when
  // becoming visible during certain states.
  //
  // eslint-disable-next-line react/sort-comp
  shouldReloadOnVisible = false;

  // This affects how the component behaves when `remountComponent` is called
  // By default, the component gets put back into a "loading" state when re-fetching data.
  // If this is true, then when we fetch data, the original ready component remains mounted
  // and it will need to handle any additional "reloading" states
  shouldReload = false;

  // should `renderError` render the `detail` attribute of a 400 error
  shouldRenderBadRequests = false;

  constructor(props, context) {
    super(props, context);

    this.fetchData = AsyncComponent.errorHandler(this, this.fetchData.bind(this));
    this.render = AsyncComponent.errorHandler(this, this.render.bind(this));

    this.state = this.getDefaultState();
  }

  componentWillMount() {
    this.api = new Client();
    this.fetchData();

    if (this.reloadOnVisible) {
      document.addEventListener('visibilitychange', this.visibilityReloader);
    }
  }

  // Compatiblity shim for child classes that call super on this hook.
  componentWillReceiveProps(newProps, newContext) {}

  componentDidUpdate(prevProps, prevContext) {
    const isRouterInContext = !!prevContext.router;
    const isLocationInProps = prevProps.location !== undefined;

    const currentLocation = isLocationInProps
      ? this.props.location
      : isRouterInContext ? this.context.router.location : null;
    const prevLocation = isLocationInProps
      ? prevProps.location
      : isRouterInContext ? prevContext.router.location : null;

    if (!(currentLocation && prevLocation)) {
      return;
    }

    // Re-fetch data when router params change.
    if (
      !isEqual(this.props.params, prevProps.params) ||
      currentLocation.search !== prevLocation.search ||
      currentLocation.state !== prevLocation.state
    ) {
      this.remountComponent();
    }
  }

  componentWillUnmount() {
    this.api.clear();
    document.removeEventListener('visibilitychange', this.visibilityReloader);
  }

  // XXX: cant call this getInitialState as React whines
  getDefaultState() {
    const endpoints = this.getEndpoints();
    const state = {
      // has all data finished requesting?
      loading: true,
      // is the component reload
      reloading: false,
      // is there an error loading ANY data?
      error: false,
      errors: {},
    };
    endpoints.forEach(([stateKey, endpoint]) => {
      state[stateKey] = null;
    });
    return state;
  }

  remountComponent = () => {
    if (this.shouldReload) {
      this.setState(
        {
          reloading: true,
        },
        this.fetchData
      );
    } else {
      this.setState(this.getDefaultState(), this.fetchData);
    }
  };

  visibilityReloader = () =>
    this.shouldReloadOnVisible &&
    !this.state.loading &&
    !document.hidden &&
    this.reloadData();

  reloadData = () => this.fetchData({reloading: true});

  fetchData = extraState => {
    const endpoints = this.getEndpoints();

    if (!endpoints.length) {
      this.setState({loading: false, error: false});
      return;
    }

    // TODO(dcramer): this should cancel any existing API requests
    this.setState({
      loading: true,
      error: false,
      remainingRequests: endpoints.length,
      ...extraState,
    });

    endpoints.forEach(([stateKey, endpoint, params, options]) => {
      options = options || {};
      // If you're using nested async components/views make sure to pass the
      // props through so that the child component has access to props.location
      const locationQuery = (this.props.location && this.props.location.query) || {};
      let query = (params && params.query) || {};
      // If paginate option then pass entire `query` object to API call
      // It should only be expecting `query.cursor` for pagination
      if (options.paginate || locationQuery.cursor) {
        query = {...locationQuery, ...query};
      }

      this.api.request(endpoint, {
        method: 'GET',
        ...params,
        query,
        success: (data, _, jqXHR) => {
          this.handleRequestSuccess({stateKey, data, jqXHR}, true);
        },
        error: error => {
          // Allow endpoints to fail
          // allowError can have side effects to handle the error
          if (options.allowError && options.allowError(error)) {
            error = null;
          }
          this.handleError(error, [stateKey, endpoint, params, options]);
        },
      });
    });
  };

  onRequestSuccess({stateKey, data, jqXHR}) {
    // Allow children to implement this
  }

  onRequestError(resp, args) {
    // Allow children to implement this
  }

  handleRequestSuccess = ({stateKey, data, jqXHR}, initialRequest) => {
    this.setState(prevState => {
      const state = {
        [stateKey]: data,
        // TODO(billy): This currently fails if this request is retried by SudoModal
        [`${stateKey}PageLinks`]: jqXHR && jqXHR.getResponseHeader('Link'),
      };

      if (initialRequest) {
        state.remainingRequests = prevState.remainingRequests - 1;
        state.loading = prevState.remainingRequests > 1;
        state.reloading = prevState.reloading && state.loading;
      }

      return state;
    });
    this.onRequestSuccess({stateKey, data, jqXHR});
  };

  handleError(error, args) {
    const [stateKey] = args;
    if (error && error.responseText) {
      Sentry.addBreadcrumb({
        message: error.responseText,
        category: 'xhr',
        level: 'error',
      });
    }
    this.setState(prevState => {
      const state = {
        [stateKey]: null,
        errors: {
          ...prevState.errors,
          [stateKey]: error,
        },
        error: prevState.error || !!error,
      };

      state.remainingRequests = prevState.remainingRequests - 1;
      state.loading = prevState.remainingRequests > 1;
      state.reloading = prevState.reloading && state.loading;

      return state;
    });
    this.onRequestError(error, args);
  }

  // DEPRECATED: use getEndpoints()
  getEndpointParams() {
    // eslint-disable-next-line no-console
    console.warn('getEndpointParams is deprecated');
    return {};
  }

  // DEPRECATED: use getEndpoints()
  getEndpoint() {
    // eslint-disable-next-line no-console
    console.warn('getEndpoint is deprecated');
    return null;
  }

  /**
   * Return a list of endpoint queries to make.
   *
   * return [
   *   ['stateKeyName', '/endpoint/', {optional: 'query params'}]
   * ]
   */
  getEndpoints() {
    const endpoint = this.getEndpoint();
    if (!endpoint) return [];
    return [['data', endpoint, this.getEndpointParams()]];
  }

  renderSearchInput({onSearchSubmit, stateKey, url, updateRoute, ...other}) {
    const [firstEndpoint] = this.getEndpoints() || [];
    const stateKeyOrDefault = stateKey || (firstEndpoint && firstEndpoint[0]);
    const urlOrDefault = url || (firstEndpoint && firstEndpoint[1]);
    return (
      <AsyncComponentSearchInput
        updateRoute={updateRoute}
        onSearchSubmit={onSearchSubmit}
        stateKey={stateKeyOrDefault}
        url={urlOrDefault}
        api={this.api}
        onSuccess={(data, jqXHR) => {
          this.handleRequestSuccess({stateKey: stateKeyOrDefault, data, jqXHR});
        }}
        onError={() => {
          this.renderError(new Error('Error with AsyncComponentSearchInput'));
        }}
        {...other}
      />
    );
  }

  renderLoading() {
    return <LoadingIndicator />;
  }

  renderError(error, disableLog = false, disableReport = false) {
    // 401s are captured by SudaModal, but may be passed back to AsyncComponent if they close the modal without identifying
    const unauthorizedErrors = Object.values(this.state.errors).find(
      resp => resp && resp.status === 401
    );

    // Look through endpoint results to see if we had any 403s, means their role can not access resource
    const permissionErrors = Object.values(this.state.errors).find(
      resp => resp && resp.status === 403
    );

    // If all error responses have status code === 0, then show error message but don't
    // log it to sentry
    const shouldLogSentry =
      !!Object.values(this.state.errors).find(resp => resp && resp.status !== 0) ||
      disableLog;

    if (unauthorizedErrors) {
      return (
        <LoadingError message={t('You are not authorized to access this resource.')} />
      );
    }

    if (permissionErrors) {
      return <PermissionDenied />;
    }

    if (this.shouldRenderBadRequests) {
      const badRequests = Object.values(this.state.errors)
        .filter(
          resp =>
            resp && resp.status === 400 && resp.responseJSON && resp.responseJSON.detail
        )
        .map(resp => resp.responseJSON.detail);

      if (badRequests.length) {
        return <LoadingError message={badRequests.join('\n')} />;
      }
    }

    return (
      <RouteError
        error={error}
        component={this}
        disableLogSentry={!shouldLogSentry}
        disableReport={disableReport}
        onRetry={this.remountComponent}
      />
    );
  }

  renderComponent() {
    return this.state.loading && (!this.shouldReload || !this.state.reloading)
      ? this.renderLoading()
      : this.state.error
        ? this.renderError(new Error('Unable to load all required endpoints'))
        : this.renderBody();
  }

  render() {
    return this.renderComponent();
  }
}
