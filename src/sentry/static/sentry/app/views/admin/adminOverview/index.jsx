import {t} from 'app/locale';
import AsyncView from 'app/views/asyncView';

import ApiChart from './apiChart';
import EventChart from './eventChart';

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
