import React from 'react';

import AsyncView from 'app/views/asyncView';
import {Panel, PanelHeader} from 'app/components/panels';
import {t} from 'app/locale';

import MonitorCheckIns from './monitorCheckIns';
import MonitorHeader from './monitorHeader';
import MonitorIssues from './monitorIssues';
import MonitorStats from './monitorStats';

class OrganizationMonitorDetails extends AsyncView {
  getEndpoints() {
    const {params, location} = this.props;
    return [
      [
        'monitor',
        `/monitors/${params.monitorId}/`,
        {
          query: location.query,
        },
      ],
    ];
  }

  getTitle() {
    if (this.state.monitor)
      return `${this.state.monitor.name} - Monitors - ${this.props.params.orgId}`;
    return `Monitors - ${this.props.params.orgId}`;
  }

  renderBody() {
    const {monitor} = this.state;
    return (
      <React.Fragment>
        <MonitorHeader monitor={monitor} />

        <MonitorStats monitor={monitor} />

        <Panel>
          <PanelHeader>{t('Related Issues')}</PanelHeader>

          <MonitorIssues monitor={monitor} orgId={this.props.params.orgId} />
        </Panel>

        <Panel>
          <PanelHeader>{t('Recent Check-ins')}</PanelHeader>

          <MonitorCheckIns monitor={monitor} />
        </Panel>
      </React.Fragment>
    );
  }
}

export default OrganizationMonitorDetails;
