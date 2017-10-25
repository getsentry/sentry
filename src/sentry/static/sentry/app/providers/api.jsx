import React from 'react';

import {Client} from '../api';

export default function withApi(WrappedComponent) {
  class WithApi extends React.Component {
    constructor(props) {
      super(props);
      this.api = new Client();
    }

    componentWillUnmount() {
      if (this.api) {
        this.api.clear();
      }
    }

    render() {
      return <WrappedComponent
        api={this.api}
        {...this.props}
      />;
    }
  }

  return WithApi;
}
