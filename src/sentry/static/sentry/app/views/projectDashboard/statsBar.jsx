import React from 'react';

import {t} from '../../locale';

const TeamStatsBar = React.createClass({
  render() {
    return (
      <div className="row team-stats">
        <div className="col-md-3 stat-column">
          <span className="count">323</span>
          <span className="count-label">{t('events seen')}</span>
        </div>
        <div className="col-md-3 stat-column">
          <span className="count">137</span>
          <span className="count-label">{t('new events')}</span>
        </div>
        <div className="col-md-3 stat-column">
          <span className="count">16</span>
          <span className="count-label">{t('releases')}</span>
        </div>
        <div className="col-md-3 stat-column align-right bad">
          <span className="count">20%</span>
          <span className="count-label">{t('more than last week')}</span>
        </div>
      </div>
    );
  }
});

export default TeamStatsBar;

