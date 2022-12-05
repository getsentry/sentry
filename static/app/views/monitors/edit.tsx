import {browserHistory, RouteComponentProps} from 'react-router';

import * as Layout from 'sentry/components/layouts/thirds';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import withOrganization from 'sentry/utils/withOrganization';
import AsyncView from 'sentry/views/asyncView';

import MonitorForm from './monitorForm';
import {Monitor} from './types';

type Props = AsyncView['props'] &
  RouteComponentProps<{monitorId: string; orgId: string}, {}> & {
    organization: Organization;
  };

type State = AsyncView['state'] & {
  monitor: Monitor | null;
};

class EditMonitor extends AsyncView<Props, State> {
  get orgSlug() {
    return this.props.organization.slug;
  }

  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const {params} = this.props;
    return [['monitor', `/monitors/${params.monitorId}/`]];
  }

  onUpdate = (data: Monitor) =>
    this.setState(state => ({monitor: {...state.monitor, ...data}}));

  onSubmitSuccess = (data: Monitor) =>
    browserHistory.push(`/organizations/${this.orgSlug}/monitors/${data.id}/`);

  getTitle() {
    if (this.state.monitor) {
      return `${this.state.monitor.name} - Monitors - ${this.orgSlug}`;
    }
    return `Monitors - ${this.orgSlug}`;
  }

  renderBody() {
    const {monitor} = this.state;

    if (monitor === null) {
      return null;
    }

    return (
      <Layout.Body>
        <Layout.Main fullWidth>
          <h1>{t('Edit Monitor')}</h1>

          <MonitorForm
            monitor={monitor}
            apiMethod="PUT"
            apiEndpoint={`/monitors/${monitor.id}/`}
            onSubmitSuccess={this.onSubmitSuccess}
          />
        </Layout.Main>
      </Layout.Body>
    );
  }
}

export default withOrganization(EditMonitor);
