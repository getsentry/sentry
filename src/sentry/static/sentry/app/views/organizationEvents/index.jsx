import {withRouter} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {getParams} from 'app/views/organizationEvents/utils/getParams';
import {t} from 'app/locale';
import BetaTag from 'app/components/betaTag';
import Feature from 'app/components/acl/feature';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import SentryTypes from 'app/sentryTypes';
import PageHeading from 'app/components/pageHeading';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import withOrganization from 'app/utils/withOrganization';
import {PageContent, PageHeader} from 'app/styles/organization';

import SearchBar from './searchBar';

class OrganizationEventsContainer extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization,
    router: PropTypes.object,
  };

  constructor(props) {
    super(props);

    this.state = {};
  }

  handleSearch = query => {
    let {router, location} = this.props;
    router.push({
      pathname: location.pathname,
      query: getParams({
        ...(location.query || {}),
        query,
      }),
    });
  };

  render() {
    const {organization, location, children} = this.props;

    return (
      <Feature features={['events']} renderDisabled>
        <GlobalSelectionHeader
          organization={organization}
          resetParamsOnChange={['cursor']}
        />
        <PageContent>
          <Body>
            <PageHeader>
              <HeaderTitle>
                {t('Events')} <BetaTag />
              </HeaderTitle>
              <StyledSearchBar
                organization={organization}
                query={(location.query && location.query.query) || ''}
                placeholder={t('Search for events, users, tags, and everything else.')}
                onSearch={this.handleSearch}
              />
            </PageHeader>

            {children}
          </Body>
        </PageContent>
      </Feature>
    );
  }
}
export default withRouter(
  withOrganization(withGlobalSelection(OrganizationEventsContainer))
);
export {OrganizationEventsContainer};

const Body = styled('div')`
  background-color: ${p => p.theme.whiteDark};
  flex-direction: column;
  flex: 1;
`;

const HeaderTitle = styled(PageHeading)`
  flex: 1;
`;

const StyledSearchBar = styled(SearchBar)`
  flex: 1;
`;
