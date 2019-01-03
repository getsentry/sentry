import React from 'react';
import styled from 'react-emotion';
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

import space from 'app/styles/space';

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
      <Content>
        <Alert type="warning">{t("You don't have access to this feature")}</Alert>
      </Content>
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
        <Content>
          <Header>
            <HeaderTitle>{t('Releases')}</HeaderTitle>
            <div>
              <SearchBar
                defaultQuery=""
                placeholder={t('Search for a release')}
                query={location.query.query}
                onSearch={this.onSearch}
              />
            </div>
          </Header>
          <Body>
            <Panel>
              <ReleaseListHeader />
              <PanelBody>{this.renderStreamBody()}</PanelBody>
            </Panel>
            <Pagination pageLinks={this.state.releaseListPageLinks} />
          </Body>
        </Content>
      </Feature>
    );
  }
}

const Content = styled('div')`
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
  padding: ${space(2)} ${space(4)} ${space(3)};
  margin-bottom: -20px; /* <footer> has margin-top: 20px; */
`;

const Header = styled('div')`
  display: flex;
  justify-content: space-between;
  margin-bottom: ${space(2)};
  align-items: center;
`;

const HeaderTitle = styled('h4')`
  flex: 1;
  font-size: ${p => p.theme.headerFontSize};
  line-height: ${p => p.theme.headerFontSize};
  font-weight: normal;
  color: ${p => p.theme.gray4};
  margin: 0;
`;

const Body = styled('div')``;

export default withOrganization(OrganizationReleases);
