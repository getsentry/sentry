/*eslint getsentry/jsx-needs-il8n:0*/
import React from 'react';

import ApiChart from './apiChart';
import AsyncView from '../asyncView';
import EventChart from './eventChart';
import {t} from '../../locale';

export default class AdminOverview extends AsyncView {
  getTitle() {
    return 'Admin Overview';
  }

  getEndpoints() {
    return [];
  }

  renderBody() {
    const resolution = '1h';
    const since = new Date().getTime() / 1000 - 3600 * 24 * 7;
    return (
      <div>
        <h3>{t('System Overview')}</h3>

        <div className="box">
          <div className="box-header">
            <h4>
              {t('Event Throughput')}
              <span id="rate" className="pull-right" />
            </h4>
          </div>
          <EventChart since={since} resolution={resolution} />
        </div>

        <div className="box">
          <div className="box-header">
            <h4>{t('API Responses')}</h4>
          </div>
          <ApiChart since={since} resolution={resolution} />
        </div>
      </div>
    );
  }
}
