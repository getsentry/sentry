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
import {mockData} from 'app/views/releasesV2/list/mock'; // TODO(releasesv2): temporary until api is finished
import PageHeading from 'app/components/pageHeading';
import {getQuery} from 'app/views/releases/list/utils';
import withOrganization from 'app/utils/withOrganization';
import {ReleasesV2RowData} from 'app/views/releasesV2/list/types';
import IntroBanner from 'app/views/releasesV2/list/introBanner';
import NoProjectMessage from 'app/components/noProjectMessage';
import LoadingIndicator from 'app/components/loadingIndicator';
import {PageContent, PageHeader} from 'app/styles/organization';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import ReleasesV2TableRow from 'app/views/releasesV2/list/releasesV2TableRow';
import ReleasesV2TableHead from 'app/views/releasesV2/list/releasesV2TableHead';
import {Panel, PanelHeader, PanelBody} from 'app/components/panels';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';

type Props = {
  params: Params;
  location: Location;
  organization: Organization;
  router: ReactRouter.InjectedRouter;
} & AsyncView['props'];

type State = {
  dummyReleasesV2List: ReleasesV2RowData[];
} & AsyncView['state'];

class ReleasesV2List extends AsyncView<Props, State> {
  getTitle() {
    return routeTitleGen(t('Releases v2'), this.props.organization.slug, false);
  }

  getDefaultState() {
    return {
      ...super.getDefaultState(),
      dummyReleasesV2List: mockData,
    };
  }

  getEndpoints(): [string, string, {}][] {
    const {organization, location} = this.props;
    // TODO(releasesv2): different url once api is finished
    return [
      [
        'releasesV2List',
        `/organizations/${organization.slug}/releases/`,
        {query: getQuery(location.query)},
      ],
    ];
  }

  handleReleaseSearch = (query: string) => {
    const {location, router, params} = this.props;

    router.push({
      pathname: `/organizations/${params.orgId}/releases-v2/`,
      query: {...location.query, query},
    });
  };

  renderLoading() {
    return this.renderBody();
  }

  renderInnerBody() {
    const {organization} = this.props;
    const {loading, dummyReleasesV2List} = this.state;

    if (loading) {
      return <LoadingIndicator />;
    }

    if (!dummyReleasesV2List.length) {
      return <EmptyStateWarning small>{t('There are no releases.')}</EmptyStateWarning>;
    }

    return dummyReleasesV2List.map(h => (
      <ReleasesV2TableRow
        errors={h.errors}
        crashes={h.crashes}
        release={h.release}
        key={h.release.name}
        graphData={h.graphData}
        activeUsers={h.activeUsers}
        organizationId={organization.slug}
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
                {t('Releases v2')} <BetaTag />
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
                  <ReleasesV2TableHead />
                </PanelHeader>
                <PanelBody>{this.renderInnerBody()}</PanelBody>
              </Panel>
              <Pagination pageLinks={this.state.releasesV2ListPageLinks} />
            </div>
          </PageContent>
        </NoProjectMessage>
      </React.Fragment>
    );
  }
}

export default withOrganization(ReleasesV2List);
export {ReleasesV2List};
