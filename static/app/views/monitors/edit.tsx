import {browserHistory, RouteComponentProps} from 'react-router';

import Breadcrumbs from 'sentry/components/breadcrumbs';
import * as Layout from 'sentry/components/layouts/thirds';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import withOrganization from 'sentry/utils/withOrganization';
import AsyncView from 'sentry/views/asyncView';

import MonitorForm from './components/monitorForm';
import {Monitor} from './types';

type Props = AsyncView['props'] &
  RouteComponentProps<{monitorSlug: string}, {}> & {
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
    return [
      ['monitor', `/organizations/${this.orgSlug}/monitors/${params.monitorSlug}/`],
    ];
  }

  onSubmitSuccess = (data: Monitor) =>
    browserHistory.push(
      normalizeUrl(`/organizations/${this.orgSlug}/crons/${data.slug}/`)
    );

  getTitle() {
    if (this.state.monitor) {
      return `${this.state.monitor.name} - Crons - ${this.orgSlug}`;
    }
    return `Crons - ${this.orgSlug}`;
  }

  renderBody() {
    const {monitor} = this.state;

    if (monitor === null) {
      return null;
    }

    return (
      <Layout.Page>
        <Layout.Header>
          <Layout.HeaderContent>
            <Breadcrumbs
              crumbs={[
                {
                  label: t('Crons'),
                  to: `/organizations/${this.orgSlug}/crons/`,
                },
                {
                  label: t('Editing %s', monitor.name),
                },
              ]}
            />
            <Layout.Title>{t('Edit Monitor')}</Layout.Title>
          </Layout.HeaderContent>
        </Layout.Header>
        <Layout.Body>
          <Layout.Main fullWidth>
            <MonitorForm
              monitor={monitor}
              apiMethod="PUT"
              apiEndpoint={`/organizations/${this.orgSlug}/monitors/${monitor.slug}/`}
              onSubmitSuccess={this.onSubmitSuccess}
            />
          </Layout.Main>
        </Layout.Body>
      </Layout.Page>
    );
  }
}

export default withOrganization(EditMonitor);
