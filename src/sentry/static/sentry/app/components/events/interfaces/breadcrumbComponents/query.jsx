import React from 'react';

import Classifier from './classifier';
import Duration from '../../../duration';

const QueryCrumbComponent = React.createClass({
  propTypes: {
    data: React.PropTypes.object.isRequired,
  },

  render() {
    let data = this.props.data;
    let placeholderIdx = 0;

    let queryElements = data.query.split(/(%s)/).map((item, idx) => {
      return item === '%s'
        ? <span key={idx} className="param">{
            data.params ? data.params[placeholderIdx++] : item}</span>
        : <span key={idx} className="literal">{item}</span>
      ;
    });

    let timing = null;
    if (data.duration !== undefined && data.duration !== null) {
      timing = <Duration key="duration" seconds={data.duration} />;
    }

    return (
      <p>
        <strong>Query:</strong> <code>{queryElements}</code>
        {timing}
        <Classifier value={data.classifier} title="%s query" />
      </p>
    );
  }
});

export default QueryCrumbComponent;
