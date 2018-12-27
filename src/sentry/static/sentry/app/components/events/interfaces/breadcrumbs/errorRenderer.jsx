import PropTypes from 'prop-types';
import React from 'react';

import CrumbTable from 'app/components/events/interfaces/breadcrumbs/crumbTable';
import SummaryLine from 'app/components/events/interfaces/breadcrumbs/summaryLine';

class ErrorRenderer extends React.Component {
  static propTypes = {
    crumb: PropTypes.object.isRequired,
  };

  renderUrl = url => {
    return url.match(/^https?:\/\//) ? <a href={url}>{url}</a> : <em>{url}</em>;
  };

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

    return <CrumbTable title="Error" summary={summary} kvData={extra} {...this.props} />;
  }
}

export default ErrorRenderer;
