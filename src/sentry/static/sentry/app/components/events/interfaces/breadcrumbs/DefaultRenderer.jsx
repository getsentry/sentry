import PropTypes from 'prop-types';
import React from 'react';

import CrumbTable from 'app/components/events/interfaces/breadcrumbs/crumbTable';
import SummaryLine from 'app/components/events/interfaces/breadcrumbs/summaryLine';

class DefaultRenderer extends React.Component {
  static propTypes = {
    crumb: PropTypes.object.isRequired,
    kvData: PropTypes.object,
  };

  getTitle = () => {
    let crumb = this.props.crumb;
    if (crumb.type === 'default') {
      return null;
    }
    return crumb.type
      .split(/[_-\s]+/g)
      .map(word => {
        return word.substr(0, 1).toUpperCase() + word.substr(1);
      })
      .join(' ');
  };

  renderSummary = () => {
    let {crumb} = this.props;

    return (
      <SummaryLine crumb={crumb}>
        {crumb.message && (
          <pre>
            <code>{crumb.message}</code>
          </pre>
        )}
      </SummaryLine>
    );
  };

  render() {
    return (
      <CrumbTable
        title={this.getTitle()}
        summary={this.renderSummary()}
        kvData={this.props.crumb.data || {}}
        {...this.props}
      />
    );
  }
}

export default DefaultRenderer;
