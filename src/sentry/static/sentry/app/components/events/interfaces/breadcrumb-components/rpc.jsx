import React from "react";

import Classifier from "./classifier";

var RpcCrumbComponent = React.createClass({
  propTypes: {
    data: React.PropTypes.object.isRequired,
  },

  render() {
    var data = this.props.data;
    return (
      <p>
        <strong>Call to</strong> <code>{data.endpoint}</code>
        <Classifier value={data.classifier} prefix="rpc" title="%s call"/>
      </p>
    );
  }
});

export default RpcCrumbComponent;
