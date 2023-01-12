import {browserHistory, RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import Breadcrumbs from 'sentry/components/breadcrumbs';
import * as Layout from 'sentry/components/layouts/thirds';
import PageHeading from 'sentry/components/pageHeading';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import withOrganization from 'sentry/utils/withOrganization';
import AsyncView from 'sentry/views/asyncView';

import MonitorForm from './monitorForm';
import {Monitor} from './types';

type Props = AsyncView['props'] &
  RouteComponentProps<{monitorId: string}, {}> & {
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
    return [['monitor', `/organizations/${this.orgSlug}/monitors/${params.monitorId}/`]];
  }

  onUpdate = (data: Monitor) =>
    this.setState(state => ({monitor: {...state.monitor, ...data}}));

  onSubmitSuccess = (data: Monitor) =>
    browserHistory.push(normalizeUrl(`/organizations/${this.orgSlug}/crons/${data.id}/`));

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
            <StyledHeading>{t('Edit Monitor')}</StyledHeading>
          </Layout.HeaderContent>
        </Layout.Header>
        <Layout.Body>
          <Layout.Main fullWidth>
            <MonitorForm
              monitor={monitor}
              apiMethod="PUT"
              apiEndpoint={`/organizations/${this.orgSlug}/monitors/${monitor.id}/`}
              onSubmitSuccess={this.onSubmitSuccess}
            />
          </Layout.Main>
        </Layout.Body>
      </Layout.Page>
    );
  }
}

const StyledHeading = styled(PageHeading)`
  line-height: 40px;
`;

export default withOrganization(EditMonitor);
