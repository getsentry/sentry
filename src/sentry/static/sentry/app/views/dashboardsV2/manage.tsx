import React from 'react';
import * as ReactRouter from 'react-router';
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
import space from 'app/styles/space';
import styled from '@emotion/styled';
import SearchBar from 'app/components/searchBar';
import pick from 'lodash/pick';

type Props = {
  organization: Organization;
  location: Location;
  router: ReactRouter.InjectedRouter;
} & AsyncComponent['props'];

type State = {
  dashboards: DashboardDetails[] | null;
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
      ...location,
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
    )
  }

  renderBody() {
    const {dashboards, dashboardsPageLinks} = this.state;
    const {organization, location} = this.props;
    return <DashboardList dashboards={dashboards} organization={organization} pageLinks={dashboardsPageLinks} location={location} />;
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
            {this.renderActions()}
            {this.renderComponent()}
          </PageContent>
        </LightWeightNoProjectMessage>
      </SentryDocumentTitle>
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

export default withOrganization(ManageDashboards);
