import React from 'react';
import {Link, withRouter} from 'react-router';
import PropTypes from 'prop-types';
import styled from 'react-emotion';
import {Box} from 'grid-emotion';

import AsyncView from 'app/views/asyncView';
import BetaTag from 'app/components/betaTag';
import {getParams} from 'app/views/organizationEvents/utils/getParams';
import {Panel, PanelBody, PanelHeader, PanelItem} from 'app/components/panels';
import {PageHeader} from 'app/styles/organization';
import PageHeading from 'app/components/pageHeading';
import TimeSince from 'app/components/timeSince';
import Pagination from 'app/components/pagination';
import SentryTypes from 'app/sentryTypes';
import SearchBar from 'app/components/searchBar';
import withOrganization from 'app/utils/withOrganization';
import {t} from 'app/locale';

import BuildIcon from './buildIcon';

const HeaderTitle = styled(PageHeading)`
  flex: 1;
`;

const StyledSearchBar = styled(SearchBar)`
  flex: 1;
`;

class OrganizationBuilds extends AsyncView {
  static propTypes = {
    organization: SentryTypes.Organization,
    location: PropTypes.object.isRequired,
  };

  static contextTypes = {
    router: PropTypes.object.isRequired,
  };

  getEndpoints() {
    const {params, location} = this.props;
    return [
      [
        'buildList',
        `/organizations/${params.orgId}/builds/`,
        {
          query: location.query,
        },
      ],
    ];
  }

  getTitle() {
    return `Builds - ${this.props.params.orgId}`;
  }

  handleSearch = query => {
    const {location} = this.props;
    const {router} = this.context;
    router.push({
      pathname: location.pathname,
      query: getParams({
        ...(location.query || {}),
        query,
      }),
    });
  };

  renderBody() {
    const {buildListPageLinks} = this.state;
    const {organization} = this.props;
    return (
      <React.Fragment>
        <PageHeader>
          <HeaderTitle>
            {t('Builds')} <BetaTag />
          </HeaderTitle>
          <StyledSearchBar
            organization={organization}
            query={(location.query && location.query.query) || ''}
            placeholder={t('Search for builds.')}
            onSearch={this.handleSearch}
          />
        </PageHeader>
        <Panel>
          <PanelHeader>
            <Box flex="1" mr={2} />
            <Box>Errors</Box>
            <Box>When</Box>
          </PanelHeader>
          <PanelBody>
            {this.state.buildList.map(build => {
              return (
                <PanelItem key={build.id}>
                  <Box style={{width: 16}} align="center" justify="center" mr={2}>
                    <BuildIcon status={build.status} size={16} />
                  </Box>
                  <Box flex="1" mr={2}>
                    <Link to={`/organizations/${organization.slug}/builds/${build.id}/`}>
                      {build.name}
                    </Link>
                  </Box>
                  <Box>{build.totalEvents.toLocaleString()}</Box>
                  <Box>
                    <TimeSince date={build.dateCreated} />
                  </Box>
                </PanelItem>
              );
            })}
          </PanelBody>
        </Panel>
        {buildListPageLinks && (
          <Pagination pageLinks={buildListPageLinks} {...this.props} />
        )}
      </React.Fragment>
    );
  }
}

export default withRouter(withOrganization(OrganizationBuilds));
