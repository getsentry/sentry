import PropTypes from 'prop-types';
import React from 'react';

import TimeSince from 'app/components/timeSince';
import {t} from 'app/locale';

import MonitorIcon from './monitorIcon';

export default class MonitorHeader extends React.Component {
  static propTypes = {
    monitor: PropTypes.object.isRequired,
  };

  render() {
    const {monitor} = this.props;

    return (
      <div className="release-details">
        <div className="row">
          <div className="col-sm-6 col-xs-10">
            <h3>{t('Monitor Details')}</h3>
            <div className="release-meta">{monitor.name}</div>
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
      </div>
    );
  }
}
