import React from 'react';
import Reflux from 'reflux';

import LatestContextStore from '../stores/latestContextStore';

const withLatestContext = WrappedComponent =>
  React.createClass({
    mixins: [Reflux.connect(LatestContextStore, 'latestContext')],
    render() {
      return (
        <WrappedComponent
          organization={this.state.latestContext.organization}
          project={this.state.latestContext.project}
          {...this.props}
        />
      );
    },
  });

export default withLatestContext;
