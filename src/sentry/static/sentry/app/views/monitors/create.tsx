import React from 'react';
import {browserHistory, RouteComponentProps} from 'react-router';

import AsyncView from 'app/views/asyncView';

import MonitorForm from './monitorForm';
import {Monitor} from './types';

type Props = AsyncView['props'] & RouteComponentProps<{orgId: string}, {}>;

export default class CreateMonitor extends AsyncView<Props, AsyncView['state']> {
  getTitle() {
    return `Monitors - ${this.props.params.orgId}`;
  }

  onSubmitSuccess = (data: Monitor) => {
    browserHistory.push(`/organizations/${this.props.params.orgId}/monitors/${data.id}/`);
  };

  renderBody() {
    return (
      <React.Fragment>
        <h1>New Monitor</h1>
        <MonitorForm
          apiMethod="POST"
          apiEndpoint={`/organizations/${this.props.params.orgId}/monitors/`}
          onSubmitSuccess={this.onSubmitSuccess}
        />
      </React.Fragment>
    );
  }
}
