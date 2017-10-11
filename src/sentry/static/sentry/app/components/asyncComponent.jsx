import PropTypes from 'prop-types';
import React from 'react';
import {isEqual} from 'lodash';

import LoadingIndicator from '../components/loadingIndicator';
import RouteError from './../views/routeError';
import {Client} from '../api';

class AsyncComponent extends React.Component {
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

  componentWillReceiveProps(nextProps) {
    // re-fetch data when router params change
    if (
      !isEqual(this.props.params, nextProps.params) ||
      this.props.location.search !== nextProps.location.search
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

  remountComponent() {
    this.setState(this.getDefaultState(), this.fetchData);
  }

  // TODO(dcramer): we'd like to support multiple initial api requests
  fetchData() {
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

    endpoints.forEach(([stateKey, endpoint, params]) => {
      this.api.request(endpoint, {
        method: 'GET',
        ...params,
        success: (data, _, jqXHR) => {
          this.setState(prevState => {
            return {
              [stateKey]: data,
              remainingRequests: prevState.remainingRequests - 1,
              loading: prevState.remainingRequests > 1,
              pageLinks: jqXHR.getResponseHeader('Link'),
            };
          });
        },
        error: error => {
          this.setState(prevState => {
            return {
              [stateKey]: null,
              errors: {
                ...prevState.errors,
                [stateKey]: error,
              },
              remainingRequests: prevState.remainingRequests - 1,
              loading: prevState.remainingRequests > 1,
              error: true,
            };
          });
        },
      });
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

AsyncComponent.contextTypes = {
  router: PropTypes.object.isRequired,
};

export default AsyncComponent;
