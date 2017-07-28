import DocumentTitle from 'react-document-title';
import React from 'react';
import {isEqual} from 'lodash';

import LoadingIndicator from '../components/loadingIndicator';
import RouteError from './routeError';
import {Client} from '../api';

class AsyncView extends React.Component {
  constructor(props, context) {
    super(props, context);

    this.fetchData = AsyncView.errorHandler(this, this.fetchData.bind(this));
    this.render = AsyncView.errorHandler(this, this.render.bind(this));

    this.state = this.getDefaultState();
  }

  componentWillMount() {
    this.api = new Client();
    this.fetchData();
  }

  componentWillReceiveProps(nextProps) {
    if (!isEqual(this.props.params, nextProps.params)) {
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
      errors: {}
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
        error: false
      });
      return;
    }
    // TODO(dcramer): this should cancel any existing API requests
    this.setState({
      loading: true,
      error: false,
      remainingRequests: endpoints.length
    });
    endpoints.forEach(([stateKey, endpoint, params]) => {
      this.api.request(endpoint, {
        method: 'GET',
        params: params,
        success: (data, _, jqXHR) => {
          this.setState(prevState => {
            return {
              [stateKey]: data,
              remainingRequests: prevState.remainingRequests - 1,
              loading: prevState.remainingRequests > 1
            };
          });
        },
        error: error => {
          this.setState(prevState => {
            return {
              [stateKey]: null,
              errors: {
                ...prevState.errors,
                [stateKey]: error
              },
              remainingRequests: prevState.remainingRequests - 1,
              loading: prevState.remainingRequests > 1,
              error: true
            };
          });
        }
      });
    });
  }

  // DEPRECATED: use getEndpoints()
  getEndpointParams() {
    return {};
  }

  // DEPRECATED: use getEndpoints()
  getEndpoint() {
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

  getTitle() {
    return 'Sentry';
  }

  renderLoading() {
    return <LoadingIndicator />;
  }

  renderError(error) {
    return <RouteError error={error} component={this} onRetry={this.remountComponent} />;
  }

  render() {
    return (
      <DocumentTitle title={this.getTitle()}>
        {this.state.loading
          ? this.renderLoading()
          : this.state.error
              ? this.renderError(new Error('Unable to load all required endpoints'))
              : this.renderBody()}
      </DocumentTitle>
    );
  }
}

AsyncView.errorHandler = (component, fn) => {
  return function(...args) {
    try {
      return fn(...args);
    } catch (err) {
      /*eslint no-console:0*/
      setTimeout(() => {
        throw err;
      });
      component.setState({
        error: err
      });
      return null;
    }
  };
};

AsyncView.contextTypes = {
  router: React.PropTypes.object.isRequired
};

export default AsyncView;
