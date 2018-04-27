/*eslint getsentry/jsx-needs-il8n:0*/
import React from 'react';

import ApiChart from 'app/views/adminOverview/apiChart';
import AsyncView from 'app/views/asyncView';
import EventChart from 'app/views/adminOverview/eventChart';
import {t} from 'app/locale';

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
