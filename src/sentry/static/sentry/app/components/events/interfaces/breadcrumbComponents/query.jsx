import React from 'react';

import Classifier from './classifier';
import Duration from '../../../duration';


function summarizeSqlQuery(sql) {
  // select
  let match;

  match = sql.match(/^\s*(select\s+(?:\s+all\b|distinct\b)?)(.*?)\bfrom\s+["`]?([^\s,."`]+)/im);
  if (match) {
    let selectors = match[2].split(/,/g);
    let selector = selectors[0].split(/\bas\b/i)[0].trim();
    if (selectors.length > 1) {
      selector += ', …';
    }
    return (
      <span className="sql-summary">
        <span className="keyword statement">{match[1].toUpperCase()}</span>{' '}
        <span className="literal">{selector}</span>{' '}
        <span className="keyword">FROM</span>{' '}
        <span className="literal">{match[3].trim()}</span>
      </span>
    );
  }

  match = sql.match(/^\s*(insert\s+into|delete\s+from|update)\s+["`]?([^\s,."`]+)/im);
  if (match) {
    return (
      <span className="sql-summary">
        <span className="keyword statement">{match[1].toUpperCase()}</span>{' '}
        <span className="literal">{match[2]}</span>
      </span>
    );
  }

  match = sql.match(/^\s*(\S+)/);
  if (match) {
    return (
      <span className="sql-summary">
        <span className="keyword statement">{match[1]}</span>
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
    };
  },

  toggleFullQuery() {
    this.setState({
      showFullQuery: !this.state.showFullQuery
    });
  },

  formatSqlParam(value) {
    if (value === null) {
      return 'NULL';
    }
    return value.toString();
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
            params ? this.formatSqlParam(params[placeholderIdx++]) : item}</span>
        : <span key={idx} className="literal">{item}</span>
      ;
    });

    return (
      <span className="query" onClick={querySummary ? this.toggleFullQuery : null}>
        {querySummary && !this.state.showFullQuery ?
          <code className="query-summary expand">
            {querySummary}
            <span className="elipsis">…</span>
          </code> : null
        }
        {!querySummary || this.state.showFullQuery ?
          <code className={'full-query' + (querySummary ? ' expand' : '')
            }>{queryElements}</code> : null}
      </span>
    );
  },

  renderTiming() {
    let {duration} = this.props.data;
    if (duration !== undefined && duration !== null) {
      return (
        <span className="timing">
          [<Duration key="duration" seconds={duration} />]
        </span>
      );
    }
    return null;
  },

  render() {
    return (
      <p>
        {this.renderQuery()}
        {this.renderTiming()}
        <Classifier value={this.props.data.classifier} title="%s query" />
      </p>
    );
  }
});

export default QueryCrumbComponent;
