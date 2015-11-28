import React from 'react';
import {t} from '../locale';

const GroupListHeader = React.createClass({
  render() {
    return (
      <div className="group-header">
        <div className="stream-actions row">
          <div className="stream-actions-left col-md-7 col-sm-8 col-xs-8 nav-header">
            {t('Event')}
          </div>
          <div className="hidden-sm hidden-xs stream-actions-graph col-md-2 col-md-offset-1 align-right nav-header">
            {t('Last 24 hours')}
          </div>
          <div className="stream-actions-count align-right col-md-1 col-sm-2 col-xs-2">{t('events')}</div>
          <div className="stream-actions-users align-right col-md-1 col-sm-2 col-xs-2">{t('users')}</div>
        </div>
      </div>
    );
  }
});

export default GroupListHeader;
