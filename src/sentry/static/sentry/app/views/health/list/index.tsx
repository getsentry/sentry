import React from 'react';
import {Location} from 'history';
import * as ReactRouter from 'react-router';
import {Params} from 'react-router/lib/Router';

import {t} from 'app/locale';
import {Organization} from 'app/types';
import AsyncView from 'app/views/asyncView';
import BetaTag from 'app/components/betaTag';
import routeTitleGen from 'app/utils/routeTitle';
import SearchBar from 'app/components/searchBar';
import Pagination from 'app/components/pagination';
import {mockData} from 'app/views/health/list/mock'; // TODO: temporary
import PageHeading from 'app/components/pageHeading';
import {getQuery} from 'app/views/releases/list/utils';
import withOrganization from 'app/utils/withOrganization';
import {HealthRowData} from 'app/views/health/list/types';
import IntroBanner from 'app/views/health/list/introBanner';
import NoProjectMessage from 'app/components/noProjectMessage';
import LoadingIndicator from 'app/components/loadingIndicator';
import {PageContent, PageHeader} from 'app/styles/organization';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import HealthTableRow from 'app/views/health/list/healthTableRow';
import HealthTableHead from 'app/views/health/list/healthTableHead';
import {Panel, PanelHeader, PanelBody} from 'app/components/panels';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';

type Props = {
  params: Params;
  location: Location;
  organization: Organization;
  router: ReactRouter.InjectedRouter;
} & AsyncView['props'];

type State = {
  dummyHealthList: HealthRowData[];
} & AsyncView['state'];

class HealthList extends AsyncView<Props, State> {
  getTitle() {
    return routeTitleGen(t('Health'), this.props.organization.slug, false);
  }

  getDefaultState() {
    return {
      ...super.getDefaultState(),
      dummyHealthList: mockData,
    };
  }

  getEndpoints(): [string, string, {}][] {
    const {organization, location} = this.props;
    // TODO: different url once api is finished
    return [
      [
        'healthList',
        `/organizations/${organization.slug}/releases/`,
        {query: getQuery(location.query)},
      ],
    ];
  }

  handleReleaseSearch = (query: string) => {
    const {location, router, params} = this.props;

    router.push({
      pathname: `/organizations/${params.orgId}/health/`,
      query: {...location.query, query},
    });
  };

  renderLoading() {
    return this.renderBody();
  }

  renderInnerBody() {
    const {organization} = this.props;
    const {loading, dummyHealthList} = this.state;

    if (loading) {
      return <LoadingIndicator />;
    }

    if (!dummyHealthList.length) {
      return (
        <EmptyStateWarning small>{t('There are no health data.')}</EmptyStateWarning>
      );
    }

    return dummyHealthList.map(h => (
      <HealthTableRow
        errors={h.errors}
        crashes={h.crashes}
        release={h.release}
        key={h.release.name}
        graphData={h.graphData}
        activeUsers={h.activeUsers}
        organizationId={organization.id}
        crashFreeUsersPercent={h.crashFreeUsersPercent}
        releaseAdoptionPercent={h.releaseAdoptionPercent}
      />
    ));
  }

  renderBody() {
    const {organization, location} = this.props;

    return (
      <React.Fragment>
        <GlobalSelectionHeader organization={organization} />

        <NoProjectMessage organization={organization}>
          <PageContent>
            <PageHeader>
              <PageHeading>
                {t('Health')} <BetaTag />
              </PageHeading>
              <SearchBar
                placeholder={t('Search for a release')}
                onSearch={this.handleReleaseSearch}
                defaultQuery={
                  typeof location.query.query === 'string' ? location.query.query : ''
                }
              />
            </PageHeader>

            <IntroBanner />

            <div>
              <Panel>
                <PanelHeader>
                  <HealthTableHead />
                </PanelHeader>
                <PanelBody>{this.renderInnerBody()}</PanelBody>
              </Panel>
              <Pagination pageLinks={this.state.healthListPageLinks} />
            </div>
          </PageContent>
        </NoProjectMessage>
      </React.Fragment>
    );
  }
}

export default withOrganization(HealthList);
export {HealthList};
