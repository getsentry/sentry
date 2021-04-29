import React from 'react';
import * as ReactRouter from 'react-router';
import styled from '@emotion/styled';
import pick from 'lodash/pick';

import {Client} from 'app/api';
import Feature from 'app/components/acl/feature';
import Alert from 'app/components/alert';
import Breadcrumbs from 'app/components/breadcrumbs';
import * as Layout from 'app/components/layouts/thirds';
import LightWeightNoProjectMessage from 'app/components/lightWeightNoProjectMessage';
import SearchBar from 'app/components/searchBar';
import {t} from 'app/locale';
import {PageContent} from 'app/styles/organization';
import space from 'app/styles/space';
import {Organization} from 'app/types';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';
import AsyncView from 'app/views/asyncView';

import {DashboardListItem} from '../types';

import DashboardList from './dashboardList';

type Props = {
  api: Client;
  organization: Organization;
  location: Location;
  router: ReactRouter.InjectedRouter;
} & AsyncView['props'];

type State = {
  dashboards: DashboardListItem[] | null;
  dashboardsPageLinks: string;
} & AsyncView['state'];

class ManageDashboards extends AsyncView<Props, State> {
  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
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

  onDashboardsChange() {
    this.reloadData();
  }

  handleSearch(query: string) {
    const {location, router} = this.props;

    router.push({
      pathname: location.pathname,
      query: {...location.query, cursor: undefined, query},
    });
  }

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
          onSearch={query => this.handleSearch(query)}
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

  renderDashboards() {
    const {dashboards, dashboardsPageLinks} = this.state;
    const {organization, location, api} = this.props;
    return (
      <DashboardList
        api={api}
        dashboards={dashboards}
        organization={organization}
        pageLinks={dashboardsPageLinks}
        location={location}
        onDashboardsChange={() => this.onDashboardsChange()}
      />
    );
  }

  getTitle() {
    return t('Manage Dashboards');
  }

  renderBody() {
    const {organization} = this.props;

    return (
      <Feature
        organization={organization}
        features={['dashboards-manage']}
        renderDisabled={this.renderNoAccess}
      >
        <LightWeightNoProjectMessage organization={organization}>
          <Layout.Header>
            <Layout.HeaderContent>
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
              <Layout.Title>{t('Manage Dashboards')}</Layout.Title>
            </Layout.HeaderContent>
            {/* <PageHeader>
              <PageHeading>{t('Manage Dashboards')}</PageHeading>
            </PageHeader> */}
          </Layout.Header>
          <Layout.Body>
            <Layout.Main fullWidth>
              {this.renderActions()}
              {this.renderDashboards()}
            </Layout.Main>
          </Layout.Body>
        </LightWeightNoProjectMessage>
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
