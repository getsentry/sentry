import React from "react";

import Classifier from "./classifier";

var QueryCrumbComponent = React.createClass({
  propTypes: {
    data: React.PropTypes.object.isRequired,
  },

  render() {
    var data = this.props.data;
    var placeholderIdx = 0;
    var queryElements = [];

    data.query.split(/(%s)/).forEach((item) => {
      queryElements.push(
        item === '%s'
          ? <span className="param">{
              data.params ? data.params[placeholderIdx++] : item}</span>
          : <span className="literal">{item}</span>
      );
    });

    return (
      <p>
        <strong>Query:</strong> <code>{queryElements}</code>
        <Classifier value={data.classifier} title="%s query" prefix="query" />
      </p>
    );
  }
});

export default QueryCrumbComponent;
