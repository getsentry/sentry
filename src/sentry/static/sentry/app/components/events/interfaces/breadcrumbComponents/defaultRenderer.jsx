import React from 'react';

import CrumbTable from './crumbTable';
import SummaryLine from './summaryLine';


const DefaultRenderer = React.createClass({
  propTypes: {
    crumb: React.PropTypes.object.isRequired,
    kvData: React.PropTypes.object,
  },

  getTitle() {
    let crumb = this.props.crumb;
    if (crumb.type === 'default') {
      return null;
    }
    return crumb.type.split(/[_-\s]+/g).map((word) => {
      return word.substr(0, 1).toUpperCase() + word.substr(1);
    }).join(' ');
  },

  renderSummary() {
    let {crumb} = this.props;

    return (
      <SummaryLine crumb={crumb}>
        {crumb.message && <pre><code>{crumb.message}</code></pre>}
      </SummaryLine>
    );
  },

  render() {
    return (
      <CrumbTable
        title={this.getTitle()}
        summary={this.renderSummary()}
        kvData={this.props.crumb.data || {}}
        {...this.props} />
    );
  }
});

export default DefaultRenderer;
