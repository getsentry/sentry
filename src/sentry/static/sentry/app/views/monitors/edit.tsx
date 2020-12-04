import React from 'react';
import {browserHistory, RouteComponentProps} from 'react-router';

import AsyncView from 'app/views/asyncView';

import MonitorForm from './monitorForm';
import {Monitor} from './types';

type Props = AsyncView['props'] &
  RouteComponentProps<{orgId: string; monitorId: string}, {}>;

type State = AsyncView['state'] & {
  monitor: Monitor | null;
};

export default class EditMonitor extends AsyncView<Props, State> {
  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const {params} = this.props;
    return [['monitor', `/monitors/${params.monitorId}/`]];
  }

  onUpdate = (data: Monitor) =>
    this.setState(state => ({monitor: {...state.monitor, ...data}}));

  onSubmitSuccess = (data: Monitor) =>
    browserHistory.push(`/organizations/${this.props.params.orgId}/monitors/${data.id}/`);

  getTitle() {
    if (this.state.monitor) {
      return `${this.state.monitor.name} - Monitors - ${this.props.params.orgId}`;
    }
    return `Monitors - ${this.props.params.orgId}`;
  }

  renderBody() {
    const {monitor} = this.state;

    if (monitor === null) {
      return null;
    }

    return (
      <React.Fragment>
        <h1>Edit Monitor</h1>

        <MonitorForm
          monitor={monitor}
          apiMethod="PUT"
          apiEndpoint={`/monitors/${monitor.id}/`}
          onSubmitSuccess={this.onSubmitSuccess}
        />
      </React.Fragment>
    );
  }
}
