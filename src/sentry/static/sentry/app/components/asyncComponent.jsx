import {isEqual} from 'lodash';
import PropTypes from 'prop-types';
import React from 'react';

import sdk from 'app/utils/sdk';
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

  componentWillReceiveProps(nextProps, nextContext) {
    const isRouterInContext = !!this.context.router;
    const isLocationInProps = nextProps.location !== undefined;

    const currentLocation = isLocationInProps
      ? this.props.location
      : isRouterInContext ? this.context.router.location : null;
    const nextLocation = isLocationInProps
      ? nextProps.location
      : isRouterInContext ? nextContext.router.location : null;

    // re-fetch data when router params change
    if (
      !isEqual(this.props.params, nextProps.params) ||
      currentLocation.search !== nextLocation.search ||
      currentLocation.state !== nextLocation.state
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
    let endpoints = this.getEndpoints();
    let state = {
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
    this.setState(this.getDefaultState(), this.fetchData);
  };

  visibilityReloader = () =>
    this.shouldReloadOnVisible &&
    !this.state.loading &&
    !document.hidden &&
    this.reloadData();

  reloadData = () => this.fetchData({reloading: true});

  fetchData = extraState => {
    let endpoints = this.getEndpoints();

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
      let locationQuery = (this.props.location && this.props.location.query) || {};
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

  handleRequestSuccess = ({stateKey, data, jqXHR}, initialRequest) => {
    this.setState(prevState => {
      let state = {
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

  handleError(error, [stateKey]) {
    if (error && error.responseText) {
      sdk.captureBreadcrumb({
        message: error.responseText,
        category: 'xhr',
        level: 'error',
      });
    }
    this.setState(prevState => {
      let state = {
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
    let endpoint = this.getEndpoint();
    if (!endpoint) return [];
    return [['data', endpoint, this.getEndpointParams()]];
  }

  renderSearchInput({onSearchSubmit, stateKey, ...other}) {
    return (
      <AsyncComponentSearchInput
        onSearchSubmit={onSearchSubmit}
        stateKey={stateKey}
        api={this.api}
        onSuccess={(data, jqXHR) => {
          this.handleRequestSuccess({stateKey, data, jqXHR});
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

  renderError(error, disableLog = false) {
    // 401s are captured by SudaModal, but may be passed back to AsyncComponent if they close the modal without identifying
    let unauthorizedErrors = Object.values(this.state.errors).find(
      resp => resp && resp.status === 401
    );

    // Look through endpoint results to see if we had any 403s, means their role can not access resource
    let permissionErrors = Object.values(this.state.errors).find(
      resp => resp && resp.status === 403
    );

    // If all error responses have status code === 0, then show error message but don't
    // log it to sentry
    let shouldLogSentry =
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

    return (
      <RouteError
        error={error}
        component={this}
        disableLogSentry={!shouldLogSentry}
        onRetry={this.remountComponent}
      />
    );
  }

  renderComponent() {
    return this.state.loading && !this.state.reloading
      ? this.renderLoading()
      : this.state.error
        ? this.renderError(new Error('Unable to load all required endpoints'))
        : this.renderBody();
  }

  render() {
    return this.renderComponent();
  }
}
