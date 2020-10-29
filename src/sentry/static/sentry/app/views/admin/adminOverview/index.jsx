import React from 'react';

import {Panel, PanelHeader, PanelBody} from 'app/components/panels';
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
      <React.Fragment>
        <h3>{t('System Overview')}</h3>

        <Panel key="events">
          <PanelHeader>{t('Event Throughput')}</PanelHeader>
          <PanelBody withPadding>
            <EventChart since={since} resolution={resolution} />
          </PanelBody>
        </Panel>

        <Panel key="api">
          <PanelHeader>{t('API Responses')}</PanelHeader>
          <PanelBody withPadding>
            <ApiChart since={since} resolution={resolution} />
          </PanelBody>
        </Panel>
      </React.Fragment>
    );
  }
}
