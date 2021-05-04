import {Fragment} from 'react';
import {RouteComponentProps} from 'react-router';

import {Panel, PanelHeader} from 'app/components/panels';
import {t} from 'app/locale';
import AsyncView from 'app/views/asyncView';

import MonitorCheckIns from './monitorCheckIns';
import MonitorHeader from './monitorHeader';
import MonitorIssues from './monitorIssues';
import MonitorStats from './monitorStats';
import {Monitor} from './types';

type Props = AsyncView['props'] &
  RouteComponentProps<{orgId: string; monitorId: string}, {}>;

type State = AsyncView['state'] & {
  monitor: Monitor | null;
};

class MonitorDetails extends AsyncView<Props, State> {
  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const {params, location} = this.props;
    return [['monitor', `/monitors/${params.monitorId}/`, {query: location.query}]];
  }

  getTitle() {
    if (this.state.monitor) {
      return `${this.state.monitor.name} - Monitors - ${this.props.params.orgId}`;
    }
    return `Monitors - ${this.props.params.orgId}`;
  }

  onUpdate = (data: Monitor) =>
    this.setState(state => ({monitor: {...state.monitor, ...data}}));

  renderBody() {
    const {monitor} = this.state;

    if (monitor === null) {
      return null;
    }

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
