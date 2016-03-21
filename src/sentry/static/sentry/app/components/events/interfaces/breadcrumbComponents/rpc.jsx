import React from 'react';

import Classifier from './classifier';

const RpcCrumbComponent = React.createClass({
  propTypes: {
    data: React.PropTypes.object.isRequired,
  },

  render() {
    let data = this.props.data;
    return (
      <p>
        <strong>Remote call to</strong> <code>{data.endpoint}</code>
        <Classifier value={data.classifier} title="%s call"/>
      </p>
    );
  }
});

export default RpcCrumbComponent;
