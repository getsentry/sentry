import PropTypes from 'prop-types';
import React from 'react';

import {t} from 'app/locale';
import CrumbTable from 'app/components/events/interfaces/breadcrumbs/crumbTable';
import SummaryLine from 'app/components/events/interfaces/breadcrumbs/summaryLine';

class HttpRenderer extends React.Component {
  static propTypes = {
    crumb: PropTypes.object.isRequired,
  };

  renderUrl = url => {
    if (typeof url === 'string') {
      return url.match(/^https?:\/\//) ? <a href={url}>{url}</a> : <em>{url}</em>;
    }

    try {
      return JSON.stringify(url);
    } catch (e) {
      return t('Invalid URL');
    }
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
