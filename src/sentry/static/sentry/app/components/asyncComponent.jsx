import {isEqual} from 'lodash';
import PropTypes from 'prop-types';
import React from 'react';

import {Client} from 'app/api';
import {t} from 'app/locale';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import PermissionDenied from 'app/views/permissionDenied';
import RouteError from 'app/views/routeError';

class AsyncComponent extends React.Component {
  static propTypes = {
    location: PropTypes.object,
  };

  static contextTypes = {
    router: PropTypes.object,
  };

  constructor(props, context) {
    super(props, context);

    this.fetchData = AsyncComponent.errorHandler(this, this.fetchData.bind(this));
    this.render = AsyncComponent.errorHandler(this, this.render.bind(this));

    this.state = this.getDefaultState();
  }

  componentWillMount() {
    this.api = new Client();
    this.fetchData();
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
  }

  // XXX: cant call this getInitialState as React whines
  getDefaultState() {
    let endpoints = this.getEndpoints();
    let state = {
      // has all data finished requesting?
      loading: true,
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

  fetchData = () => {
    let endpoints = this.getEndpoints();

    if (!endpoints.length) {
      this.setState({
        loading: false,
        error: false,
      });
      return;
    }

    // TODO(dcramer): this should cancel any existing API requests
    this.setState({
      loading: true,
      error: false,
      remainingRequests: endpoints.length,
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
      }

      return state;
    });
  };

  handleError(error, [stateKey]) {
    if (error && error.responseText) {
      Raven.captureBreadcrumb({
        message: error.responseText,
        category: 'xhr',
        level: 'error',
      });
    }
    this.setState(prevState => {
      return {
        [stateKey]: null,
        errors: {
          ...prevState.errors,
          [stateKey]: error,
        },
        remainingRequests: prevState.remainingRequests - 1,
        loading: prevState.remainingRequests > 1,
        error: prevState.error || !!error,
      };
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

  renderLoading() {
    return <LoadingIndicator />;
  }

  renderError(error) {
    let unauthorizedErrors = Object.keys(this.state.errors).find(endpointName => {
      let result = this.state.errors[endpointName];
      // 401s are captured by SudaModal, but may be passed back to AsyncComponent if they close the modal without identifying
      return result && result.status === 401;
    });

    // Look through endpoint results to see if we had any 403s, means their role can not access resource
    let permissionErrors = Object.keys(this.state.errors).find(endpointName => {
      let result = this.state.errors[endpointName];
      return result && result.status === 403;
    });

    if (unauthorizedErrors) {
      return (
        <LoadingError message={t('You are not authorized to access this resource.')} />
      );
    }

    if (permissionErrors) {
      return <PermissionDenied />;
    }

    return <RouteError error={error} component={this} onRetry={this.remountComponent} />;
  }

  renderComponent() {
    return this.state.loading
      ? this.renderLoading()
      : this.state.error
        ? this.renderError(new Error('Unable to load all required endpoints'))
        : this.renderBody();
  }

  render() {
    return this.renderComponent();
  }
}

AsyncComponent.errorHandler = (component, fn) => {
  return function(...args) {
    try {
      return fn(...args);
    } catch (err) {
      /*eslint no-console:0*/
      console.error(err);
      setTimeout(() => {
        throw err;
      });
      component.setState({
        error: err,
      });
      return null;
    }
  };
};

export default AsyncComponent;
