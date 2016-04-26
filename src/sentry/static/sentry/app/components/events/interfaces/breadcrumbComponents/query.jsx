import React from 'react';

import Classifier from './classifier';
import Duration from '../../../duration';


function summarizeSqlQuery(sql) {
  let match = sql.match(/^\s*select\b(.*?)\bfrom\s+["`]?([^\s,."`]+)/im);
  if (match) {
    let selectors = match[1].split(/,/g);
    let selector = selectors[0].split(/\bas\b/i)[0].trim();
    if (selectors.length > 1) {
      selector += ', …';
    }
    return (
      <span className="sql-summary">
        <span className="keyword statement">SELECT</span>{' '}
        <span className="literal">{selector}</span>{' '}
        <span className="keyword">FROM</span>{' '}
        <span className="literal">{match[2].trim()}</span>
      </span>
    );
  }
  return null;
}


const QueryCrumbComponent = React.createClass({
  propTypes: {
    data: React.PropTypes.object.isRequired,
  },

  getInitialState() {
    return {
      showFullQuery: false
    }
  },

  toggleFullQuery() {
    this.setState({
      showFullQuery: !this.state.showFullQuery
    })
  },

  renderQuery() {
    let {query, params} = this.props.data;

    if (typeof query !== 'string') {
      return (
        <span className="query">
          <code className="full-query">
            <span className="json">{JSON.stringify(query, null, 2)}</span>
          </code>
        </span>
      );
    }

    let querySummary = summarizeSqlQuery(query);
    let placeholderIdx = 0;
    let queryElements = query.split(/(%s)/).map((item, idx) => {
      return item === '%s'
        ? <span key={idx} className="param">{
            params ? params[placeholderIdx++] : item}</span>
        : <span key={idx} className="literal">{item}</span>
      ;
    });

    let timing = null;
    if (data.duration !== undefined && data.duration !== null) {
      timing = <Duration key="duration" seconds={data.duration} />;
    }

    return (
      <span className="query" onClick={querySummary ? this.toggleFullQuery : null}>
        {querySummary && !this.state.showFullQuery ?
          <code className="query-summary">
            {querySummary}
            <span className="elipsis">…</span>
          </code> : null
        }
        {this.state.showFullQuery ?
          <code className="full-query">{queryElements}</code> : null}
      </span>
    );
  },

  render() {
    return (
      <p>
        <strong className="preamble">Query:</strong>
        {this.renderQuery()}
        {timing}
        <Classifier value={this.props.data.classifier} title="%s query" />
      </p>
    );
  }
});

export default QueryCrumbComponent;
