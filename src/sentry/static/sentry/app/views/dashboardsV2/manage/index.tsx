import React from 'react';
import {Location} from 'history';

import Breadcrumbs from 'app/components/breadcrumbs';
import PageHeading from 'app/components/pageHeading';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import {t} from 'app/locale';
import {PageContent, PageHeader} from 'app/styles/organization';
import {Organization} from 'app/types';
import withOrganization from 'app/utils/withOrganization';
import DashboardsV2ManageList from 'app/views/dashboardsV2/manage/list';

type Props = {
  organization: Organization;
  location: Location;
};

class DashboardsV2Manage extends React.Component<Props> {
  render() {
    const {organization, location} = this.props;

    return (
      <SentryDocumentTitle title={t('Manage Dashboards')} orgSlug={organization.slug}>
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
          <PageContent>
            <DashboardsV2ManageList location={location} />
          </PageContent>
        </PageContent>
      </SentryDocumentTitle>
    );
  }
}

export default withOrganization(DashboardsV2Manage);
