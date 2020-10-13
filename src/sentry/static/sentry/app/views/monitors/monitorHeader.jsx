import PropTypes from 'prop-types';
import React from 'react';

import TimeSince from 'app/components/timeSince';
import {t} from 'app/locale';
import SentryTypes from 'app/sentryTypes';

import MonitorHeaderActions from './monitorHeaderActions';
import MonitorIcon from './monitorIcon';

export default class MonitorHeader extends React.Component {
  static propTypes = {
    orgId: PropTypes.string.isRequired,
    monitor: SentryTypes.Monitor.isRequired,
    onUpdate: PropTypes.func,
  };

  render() {
    const {monitor} = this.props;

    return (
      <div className="release-details">
        <div className="row">
          <div className="col-sm-6 col-xs-10">
            <h3>{monitor.name}</h3>
            <div className="release-meta">{monitor.id}</div>
          </div>
          <div className="col-sm-2 hidden-xs">
            <h6 className="nav-header">{t('Last Check-in')}</h6>
            {monitor.lastCheckIn && <TimeSince date={monitor.lastCheckIn} />}
          </div>
          <div className="col-sm-2 hidden-xs">
            <h6 className="nav-header">{t('Next Check-in')}</h6>
            {monitor.nextCheckIn && <TimeSince date={monitor.nextCheckIn} />}
          </div>
          <div className="col-sm-2">
            <h6 className="nav-header">{t('Status')}</h6>
            <MonitorIcon status={monitor.status} size={16} />
          </div>
        </div>
        <MonitorHeaderActions
          orgId={this.props.orgId}
          monitor={monitor}
          onUpdate={this.props.onUpdate}
        />
      </div>
    );
  }
}
