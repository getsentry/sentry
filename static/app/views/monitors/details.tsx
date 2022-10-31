import {Fragment} from 'react';
import {RouteComponentProps} from 'react-router';

import {Panel, PanelHeader} from 'sentry/components/panels';
import {t} from 'sentry/locale';
import AsyncView from 'sentry/views/asyncView';

import MonitorCheckIns from './monitorCheckIns';
import MonitorHeader from './monitorHeader';
import MonitorIssues from './monitorIssues';
import MonitorStats from './monitorStats';
import MonitorOnboarding from './onboarding';
import {Monitor} from './types';

type Props = AsyncView['props'] &
  RouteComponentProps<{monitorId: string; orgId: string}, {}>;

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

        {!monitor.lastCheckIn && <MonitorOnboarding monitor={monitor} />}

        <MonitorStats monitor={monitor} />

        <MonitorIssues monitor={monitor} orgId={this.props.params.orgId} />

        <Panel>
          <PanelHeader>{t('Recent Check-ins')}</PanelHeader>

          <MonitorCheckIns monitor={monitor} />
        </Panel>
      </Fragment>
    );
  }
}

export default MonitorDetails;
