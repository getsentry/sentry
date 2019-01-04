import React from 'react';
import {browserHistory} from 'react-router';

import SentryTypes from 'app/sentryTypes';
import {t} from 'app/locale';

import SearchBar from 'app/components/searchBar';
import {Panel, PanelBody} from 'app/components/panels';
import Pagination from 'app/components/pagination';
import LoadingIndicator from 'app/components/loadingIndicator';
import Alert from 'app/components/alert';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import Feature from 'app/components/acl/feature';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import AsyncView from 'app/views/asyncView';

import withOrganization from 'app/utils/withOrganization';

import {PageContent, PageHeader, HeaderTitle} from 'app/styles/organization';

import ReleaseList from '../shared/releaseList';
import ReleaseListHeader from '../shared/releaseListHeader';
import {getQuery} from '../shared/utils';

class OrganizationReleases extends AsyncView {
  static propTypes = {
    organization: SentryTypes.Organization,
  };

  getTitle() {
    return `${t('Releases')} - ${this.props.organization.slug}`;
  }

  getEndpoints() {
    const {organization, location} = this.props;
    return [
      [
        'releaseList',
        `/organizations/${organization.slug}/releases/`,
        {query: getQuery(location.query)},
      ],
    ];
  }

  onSearch = query => {
    let targetQueryParams = {};
    if (query !== '') targetQueryParams.query = query;

    let {orgId} = this.props.params;
    browserHistory.push({
      pathname: `/organizations/${orgId}/releases/`,
      query: targetQueryParams,
    });
  };

  renderStreamBody() {
    if (this.state.loading) {
      return <LoadingIndicator />;
    }

    if (this.state.releaseList.length === 0) {
      return this.renderNoQueryResults();
    }

    return (
      <ReleaseList
        releaseList={this.state.releaseList}
        orgId={this.props.organization.slug}
      />
    );
  }

  renderNoQueryResults() {
    return (
      <EmptyStateWarning>
        <p>{t('Sorry, no releases match your filters.')}</p>
      </EmptyStateWarning>
    );
  }

  renderNoAccess() {
    return (
      <PageContent>
        <Alert type="warning">{t("You don't have access to this feature")}</Alert>
      </PageContent>
    );
  }

  renderLoading() {
    return this.renderBody();
  }

  renderBody() {
    const {organization, location} = this.props;

    return (
      <Feature
        features={['organizations:sentry10']}
        organization={organization}
        renderDisabled={this.renderNoAccess}
      >
        <GlobalSelectionHeader organization={organization} />
        <PageContent>
          <PageHeader>
            <HeaderTitle>{t('Releases')}</HeaderTitle>
            <div>
              <SearchBar
                defaultQuery=""
                placeholder={t('Search for a release')}
                query={location.query.query}
                onSearch={this.onSearch}
              />
            </div>
          </PageHeader>
          <div>
            <Panel>
              <ReleaseListHeader />
              <PanelBody>{this.renderStreamBody()}</PanelBody>
            </Panel>
            <Pagination pageLinks={this.state.releaseListPageLinks} />
          </div>
        </PageContent>
      </Feature>
    );
  }
}

export default withOrganization(OrganizationReleases);
