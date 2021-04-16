import React from 'react';
import {Location} from 'history';

import AsyncComponent from 'app/components/asyncComponent';
import Breadcrumbs from 'app/components/breadcrumbs';
import LightWeightNoProjectMessage from 'app/components/lightWeightNoProjectMessage';
import PageHeading from 'app/components/pageHeading';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import {t} from 'app/locale';
import {PageContent, PageHeader} from 'app/styles/organization';
import {Organization} from 'app/types';
import withOrganization from 'app/utils/withOrganization';

import DashboardList from './dashboardList';
import {DashboardDetails} from './types';

type Props = {
  organization: Organization;
  location: Location;
} & AsyncComponent['props'];

type State = {
  dashboards: DashboardDetails[] | null;
} & AsyncComponent['state'];

class ManageDashboards extends AsyncComponent<Props, State> {
  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {organization} = this.props;
    return [['dashboards', `/organizations/${organization.slug}/dashboards/`]];
  }

  renderBody() {
    const {dashboards} = this.state;
    const {organization} = this.props;
    return <DashboardList dashboards={dashboards} organization={organization} />;
  }

  render() {
    const {organization} = this.props;

    return (
      <SentryDocumentTitle title={t('Manage Dashboards')} orgSlug={organization.slug}>
        <LightWeightNoProjectMessage organization={organization}>
          <PageContent>
            <Breadcrumbs
              crumbs={[
                {
                  label: 'Dashboards',
                  to: `/organizations/${organization.slug}/dashboards/`,
                },
                {
                  label: 'Manage Dashboards',
                },
              ]}
            />
            <PageHeader>
              <PageHeading>Manage Dashboards</PageHeading>
            </PageHeader>
            {this.renderComponent()}
          </PageContent>
        </LightWeightNoProjectMessage>
      </SentryDocumentTitle>
    );
  }
}

export default withOrganization(ManageDashboards);
