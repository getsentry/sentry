import React from 'react';
import * as ReactRouter from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';
import pick from 'lodash/pick';

import {Client} from 'app/api';
import Feature from 'app/components/acl/feature';
import Alert from 'app/components/alert';
import AsyncComponent from 'app/components/asyncComponent';
import Breadcrumbs from 'app/components/breadcrumbs';
import Button from 'app/components/button';
import LightWeightNoProjectMessage from 'app/components/lightWeightNoProjectMessage';
import PageHeading from 'app/components/pageHeading';
import SearchBar from 'app/components/searchBar';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import {IconAdd} from 'app/icons';
import {t} from 'app/locale';
import {PageContent, PageHeader} from 'app/styles/organization';
import space from 'app/styles/space';
import {Organization} from 'app/types';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';

import {DashboardListItem} from '../types';

import DashboardList from './dashboardList';

type Props = {
  api: Client;
  organization: Organization;
  location: Location;
  router: ReactRouter.InjectedRouter;
} & AsyncComponent['props'];

type State = {
  dashboards: DashboardListItem[] | null;
  dashboardsPageLinks: string;
} & AsyncComponent['state'];

class ManageDashboards extends AsyncComponent<Props, State> {
  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {organization, location} = this.props;
    return [
      [
        'dashboards',
        `/organizations/${organization.slug}/dashboards/`,
        {
          query: {
            ...pick(location.query, ['cursor', 'query']),
            per_page: '9',
          },
        },
      ],
    ];
  }

  handleSearch = (query: string) => {
    const {location, router} = this.props;

    router.push({
      pathname: location.pathname,
      query: {...location.query, cursor: undefined, query},
    });
  };

  getQuery() {
    const {query} = this.props.location.query;

    return typeof query === 'string' ? query : undefined;
  }

  renderActions() {
    return (
      <StyledActions>
        <StyledSearchBar
          defaultQuery=""
          query={this.getQuery()}
          placeholder={t('Search Dashboards')}
          onSearch={this.handleSearch}
        />
      </StyledActions>
    );
  }

  renderNoAccess() {
    return (
      <PageContent>
        <Alert type="warning">{t("You don't have access to this feature")}</Alert>
      </PageContent>
    );
  }

  renderBody() {
    const {dashboards, dashboardsPageLinks} = this.state;
    const {organization, location, api} = this.props;
    return (
      <DashboardList
        api={api}
        dashboards={dashboards}
        organization={organization}
        pageLinks={dashboardsPageLinks}
        location={location}
      />
    );
  }

  onCreate() {}

  render() {
    const {organization} = this.props;

    return (
      <Feature
        organization={organization}
        features={['dashboards-manage']}
        renderDisabled={this.renderNoAccess}
      >
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
                <Button
                  data-test-id="dashboard-create"
                  to={{
                    pathname: `/organizations/${organization.slug}/dashboards/create/`,
                  }}
                  priority="primary"
                  icon={<IconAdd size="xs" isCircled />}
                >
                  {t('Create Dashboard')}
                </Button>
              </PageHeader>
              {this.renderActions()}
              {this.renderComponent()}
            </PageContent>
          </LightWeightNoProjectMessage>
        </SentryDocumentTitle>
      </Feature>
    );
  }
}

const StyledSearchBar = styled(SearchBar)`
  flex-grow: 1;
`;

const StyledActions = styled('div')`
  display: grid;
  grid-template-columns: auto max-content min-content;

  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    grid-template-columns: auto;
  }

  align-items: center;
  margin-bottom: ${space(3)};
`;

export default withApi(withOrganization(ManageDashboards));
