import React from 'react';
import {browserHistory} from 'react-router';

import AsyncView from 'app/views/asyncView';

import MonitorForm from './monitorForm';

export default class EditMonitor extends AsyncView {
  getEndpoints() {
    const {params} = this.props;
    return [['monitor', `/monitors/${params.monitorId}/`]];
  }

  onUpdate = data => {
    this.setState({
      monitor: {
        ...this.state.monitor,
        ...data,
      },
    });
  };

  onSubmitSuccess = data => {
    browserHistory.push(`/organizations/${this.props.params.orgId}/monitors/${data.id}/`);
  };

  getTitle() {
    if (this.state.monitor) {
      return `${this.state.monitor.name} - Monitors - ${this.props.params.orgId}`;
    }
    return `Monitors - ${this.props.params.orgId}`;
  }

  renderBody() {
    const {monitor} = this.state;
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
