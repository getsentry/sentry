import React from 'react';

import Classifier from './classifier';

const QueryCrumbComponent = React.createClass({
  propTypes: {
    data: React.PropTypes.object.isRequired,
  },

  render() {
    let data = this.props.data;
    let placeholderIdx = 0;
    let queryElements = [];

    data.query.split(/(%s)/).forEach((item, idx) => {
      queryElements.push(
        item === '%s'
          ? <span key={idx} className="param">{
              data.params ? data.params[placeholderIdx++] : item}</span>
          : <span key={idx} className="literal">{item}</span>
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
