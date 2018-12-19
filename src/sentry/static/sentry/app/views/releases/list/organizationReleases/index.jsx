import React from 'react';
import styled from 'react-emotion';
import PropTypes from 'prop-types';
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
import withGlobalSelection from 'app/utils/withGlobalSelection';

import space from 'app/styles/space';

import ReleaseList from '../shared/releaseList';
import ReleaseListHeader from '../shared/releaseListHeader';
import {fetchOrganizationReleases} from '../shared/utils';

class OrganizationReleases extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization,
    selection: PropTypes.object,
  };
  constructor(props) {
    super(props);
    this.state = {releaseList: [], loading: true, error: null};
  }

  componentDidMount() {
    this.fetchData({query: this.props.location.query.query, ...this.props.selection});
  }

  componentDidUpdate(prevProps) {
    const queryHasChanged =
      prevProps.location.query.query !== this.props.location.query.query;

    if (queryHasChanged) {
      this.fetchData({query: this.props.location.query.query, ...this.props.selection});
    }
  }

  fetchData(query) {
    this.setState({loading: true});
    fetchOrganizationReleases(this.props.organization, query)
      .then(releaseList => {
        this.setState({releaseList, loading: false, error: null});
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
    return <Alert type="warning">{t("You don't have access to this feature")}</Alert>;
  }

  render() {
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

export default withOrganization(withGlobalSelection(OrganizationReleases));
