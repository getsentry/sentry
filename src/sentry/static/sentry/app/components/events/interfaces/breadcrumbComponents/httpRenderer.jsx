import React from 'react';

import CrumbTable from './crumbTable';
import SummaryLine from './summaryLine';


const HttpRenderer = React.createClass({
  propTypes: {
    crumb: React.PropTypes.object.isRequired,
  },

  render() {
    let {crumb} = this.props;
    let {method, status_code, reason, url, ...extra} = crumb.data;
    let summary = (
      <SummaryLine crumb={crumb}>
        <pre>
          <code>{method + ' ' + url + ' [' + status_code + ']'}</code>
        </pre>
      </SummaryLine>
    );

    return (
      <CrumbTable
        title="HTTP Request"
        summary={summary}
        kvData={extra}
        {...this.props} />
    );
  }
});

export default HttpRenderer;
