import React from 'react';

import CrumbTable from './crumbTable';
import SummaryLine from './summaryLine';


const ErrorRenderer = React.createClass({
  propTypes: {
    crumb: React.PropTypes.object.isRequired,
  },

  renderUrl(url) {
    return (
      url.match(/^https?:\/\//)
        ? <a href={url}>{url}</a>
        : <em>{url}</em>
    );
  },

  render() {
    let {crumb} = this.props;
    let {type, value, ...extra} = crumb.data || {};
    let messages = [];

    if (value) {
      messages.push(value);
    }
    if (crumb.message) {
      messages.push(crumb.message);
    }

    let summary = (
      <SummaryLine crumb={crumb}>
        <pre>
          <code>
            {type && <strong>{type}: </strong>}
            {messages.join('. ')}
          </code>
        </pre>
      </SummaryLine>
    );

    return (
      <CrumbTable
        title="Error"
        summary={summary}
        kvData={extra}
        {...this.props} />
    );
  }
});

export default ErrorRenderer;
