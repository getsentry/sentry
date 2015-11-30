import React from 'react';
import PropTypes from '../../../proptypes';

import GroupEventDataSection from '../eventDataSection';
import CSPContent from './cspContent';
import CSPHelp from './cspHelp';
import {t} from '../../../locale';

function getView(view, data) {
  switch (view) {
    case 'report':
      return <CSPContent data={data} />;
    case 'raw':
      return <pre>{JSON.stringify({'csp-report': data}, null, 2)}</pre>;
    case 'help':
      return <CSPHelp data={data} />;
    default:
      throw new TypeError(`Invalid view: ${view}`);
  }
}

const CSPInterface = React.createClass({
  propTypes: {
    group: PropTypes.Group.isRequired,
    event: PropTypes.Event.isRequired,
    type: React.PropTypes.string.isRequired,
    data: React.PropTypes.object.isRequired,
  },

  getInitialState() {
    let {data} = this.props;
    // hide the report-uri since this is redundant and silly
    data.original_policy = data.original_policy.replace(/(;\s+)?report-uri [^;]+/, '');

    return {
      view: 'report',
      data: data
    };
  },

  toggleView(value) {
    this.setState({
      view: value
    });
  },

  render() {
    let {view, data} = this.state;
    let {group, event} = this.props;

    let title = (
      <div>
        <div className="btn-group">
          <a className={(view === 'report' ? 'active' : '') + ' btn btn-default btn-sm'} onClick={this.toggleView.bind(this, 'report')}>{t('Report')}</a>
          <a className={(view === 'raw' ? 'active' : '') + ' btn btn-default btn-sm'} onClick={this.toggleView.bind(this, 'raw')}>{t('Raw')}</a>
          <a className={(view === 'help' ? 'active' : '') + ' btn btn-default btn-sm'} onClick={this.toggleView.bind(this, 'help')}>{t('Help')}</a>
        </div>
        <h3>{t('CSP Report')}</h3>
      </div>
    );

    let children = getView(view, data);

    return (
      <GroupEventDataSection
          group={group}
          event={event}
          type="csp"
          title={title}
          wrapTitle={false}>
          {children}
      </GroupEventDataSection>
    );
  }
});

export default CSPInterface;
