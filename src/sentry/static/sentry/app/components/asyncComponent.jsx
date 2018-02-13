import {isEqual} from 'lodash';
import PropTypes from 'prop-types';
import Raven from 'raven-js';
import React from 'react';

import {Client} from '../api';
import {tct} from '../locale';
import ExternalLink from './externalLink';
import LoadingError from './loadingError';
import LoadingIndicator from '../components/loadingIndicator';
import RouteError from './../views/routeError';

class AsyncComponent extends React.Component {
  static contextTypes = {
    router: PropTypes.object.isRequired,
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
    // re-fetch data when router params change
    if (
      !isEqual(this.props.params, nextProps.params) ||
      this.context.router.location.search !== nextContext.router.location.search
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
      let paramsQuery = (params && params.query) || {};
      // If paginate option then pass entire `query` object to API call
      // It should only be expecting `query.cursor` for pagination
      let query = options.paginate && {...locationQuery, ...paramsQuery};

      this.api.request(endpoint, {
        method: 'GET',
        ...params,
        query,
        success: (data, _, jqXHR) => {
          this.setState(prevState => {
            return {
              [stateKey]: data,
              [`${stateKey}PageLinks`]: jqXHR.getResponseHeader('Link'),
              remainingRequests: prevState.remainingRequests - 1,
              loading: prevState.remainingRequests > 1,
            };
          });
        },
        error: error => {
          // Allow endpoints to fail
          if (options.allowError && options.allowError(error)) {
            error = null;
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
        },
      });
    });
  };

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
    // Look through endpoint results to see if we had any 403s
    let permissionErrors = Object.keys(this.state.errors).find(endpointName => {
      let result = this.state.errors[endpointName];

      return result && result.status === 403;
    });

    if (permissionErrors) {
      // TODO(billy): Refactor this into a new PermissionDenied component
      Raven.captureException(new Error('Permission Denied'), {});
      return (
        <LoadingError
          message={tct(
            'You do not have permission to access this, please read more about [link:organizational roles]',
            {
              link: <ExternalLink href="https://docs.sentry.io/learn/membership/" />,
            }
          )}
        />
      );
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
