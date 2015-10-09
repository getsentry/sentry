import React from "react";

import Classifier from "./classifier";

var QueryCrumbComponent = React.createClass({
  propTypes: {
    data: React.PropTypes.object.isRequired,
  },

  render() {
    var data = this.props.data;
    return (
      <p>
        <strong>Query:</strong> <code>{data.query}</code>
        <Classifier value={data.classifier} title="%s query" prefix="query" />
      </p>
    );
  }
});

export default QueryCrumbComponent;
