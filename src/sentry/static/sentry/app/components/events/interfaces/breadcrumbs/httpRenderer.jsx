import PropTypes from 'prop-types';
import React from 'react';

import CrumbTable from 'app/components/events/interfaces/breadcrumbs/crumbTable';
import SummaryLine from 'app/components/events/interfaces/breadcrumbs/summaryLine';

class HttpRenderer extends React.Component {
  static propTypes = {
    crumb: PropTypes.object.isRequired,
  };

  renderUrl = url => {
    return typeof url === 'string' && url.match(/^https?:\/\//) ? (
      <a href={url}>{url}</a>
    ) : (
      <em>{url}</em>
    );
  };

  render() {
    const {crumb} = this.props;
    const {method, status_code, url, ...extra} = crumb.data || {};
    const summary = (
      <SummaryLine crumb={crumb}>
        <pre>
          <code>
            {method && <strong>{method} </strong>}
            {url && this.renderUrl(url)}
            {status_code !== undefined ? <span>{' [' + status_code + ']'}</span> : ''}
          </code>
        </pre>
      </SummaryLine>
    );

    return (
      <CrumbTable title="HTTP Request" summary={summary} kvData={extra} {...this.props} />
    );
  }
}

export default HttpRenderer;
