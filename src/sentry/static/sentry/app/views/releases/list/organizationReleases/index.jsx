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

import withOrganization from 'app/utils/withOrganization';

import space from 'app/styles/space';

import ReleaseList from '../shared/releaseList';
import ReleaseListHeader from '../shared/releaseListHeader';
import {fetchOrganizationReleases, getQuery} from '../shared/utils';

class OrganizationReleases extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization,
  };
  constructor(props) {
    super(props);
    this.state = {releaseList: [], loading: true, error: null};
  }

  componentDidMount() {
    this.fetchData();
  }

  componentDidUpdate(prevProps) {
    const queryHasChanged = prevProps.location.search !== this.props.location.search;

    if (queryHasChanged) {
      this.fetchData();
    }
  }

  fetchData() {
    const {organization, location} = this.props;
    const query = getQuery(location.search);

    this.setState({loading: true});
    fetchOrganizationReleases(organization.slug, query)
      .then(([releaseList, _, jqXHR]) => {
        this.setState({
          releaseList,
          loading: false,
          error: null,
          pageLinks: jqXHR.getResponseHeader('Link'),
        });
      })
      .catch(error => {
        this.setState({error, loading: false});
      });
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

  render() {
    if (!new Set(this.props.organization.features).has('sentry10')) {
      return this.renderNoAccess();
    }

    return (
      <Content>
        <Header>
          <div>
            <HeaderTitle>{t('Releases')}</HeaderTitle>
          </div>
          <div>
            <SearchBar
              defaultQuery=""
              placeholder={t('Search for a release')}
              query={this.props.location.query.query}
              onSearch={this.onSearch}
            />
          </div>
        </Header>
        <Body>
          <Panel>
            <ReleaseListHeader />
            <PanelBody>{this.renderStreamBody()}</PanelBody>
          </Panel>
          <Pagination pageLinks={this.state.pageLinks} />
        </Body>
      </Content>
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
