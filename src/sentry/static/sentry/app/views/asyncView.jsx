import DocumentTitle from 'react-document-title';
import React from 'react';
import underscore from 'underscore';

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
    if (!underscore.isEqual(this.props.params, nextProps.params)) {
      this.remountComponent();
    }
  }

  componentWillUnmount() {
    this.api.clear();
  }

  // XXX: cant call this getInitialState as React whines
  getDefaultState() {
    return {
      data: null,
      loading: true,
      error: false
    };
  }

  remountComponent() {
    this.setState(this.getDefaultState(), this.fetchData);
  }

  // TODO(dcramer): we'd like to support multiple initial api requests
  fetchData() {
    let endpoint = this.getEndpoint();
    if (!endpoint) {
      this.setState({
        loading: false,
        error: false
      });
    } else {
      this.api.request(endpoint, {
        method: 'GET',
        params: this.getEndpointParams(),
        success: (data, _, jqXHR) => {
          this.setState({
            loading: false,
            error: false,
            data: data
          });
        },
        error: error => {
          this.setState({
            loading: false,
            error: error
          });
        }
      });
    }
  }

  getEndpointParams() {
    return {};
  }

  getEndpoint() {
    return null;
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
          : this.state.error ? this.renderError(this.state.error) : this.renderBody()}
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
