import {Fragment} from 'react';

import AsyncView from 'app/views/asyncView';
import {Panel, PanelHeader} from 'app/components/panels';
import {t} from 'app/locale';

import MonitorCheckIns from './monitorCheckIns';
import MonitorHeader from './monitorHeader';
import MonitorIssues from './monitorIssues';
import MonitorStats from './monitorStats';

class MonitorDetails extends AsyncView {
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
    if (this.state.monitor) {
      return `${this.state.monitor.name} - Monitors - ${this.props.params.orgId}`;
    }
    return `Monitors - ${this.props.params.orgId}`;
  }

  onUpdate = data => {
    this.setState({
      monitor: {
        ...this.state.monitor,
        ...data,
      },
    });
  };

  renderBody() {
    const {monitor} = this.state;
    return (
      <Fragment>
        <MonitorHeader
          monitor={monitor}
          orgId={this.props.params.orgId}
          onUpdate={this.onUpdate}
        />

        <MonitorStats monitor={monitor} />

        <Panel style={{paddingBottom: 0}}>
          <PanelHeader>{t('Related Issues')}</PanelHeader>

          <MonitorIssues monitor={monitor} orgId={this.props.params.orgId} />
        </Panel>

        <Panel>
          <PanelHeader>{t('Recent Check-ins')}</PanelHeader>

          <MonitorCheckIns monitor={monitor} />
        </Panel>
      </Fragment>
    );
  }
}

export default MonitorDetails;
