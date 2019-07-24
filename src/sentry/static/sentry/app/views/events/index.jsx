import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {getParams} from 'app/views/events/utils/getParams';
import {t} from 'app/locale';
import BetaTag from 'app/components/betaTag';
import Feature from 'app/components/acl/feature';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import NoProjectMessage from 'app/components/noProjectMessage';
import SentryTypes from 'app/sentryTypes';
import PageHeading from 'app/components/pageHeading';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import withOrganization from 'app/utils/withOrganization';
import {PageContent, PageHeader} from 'app/styles/organization';
import LazyLoad from 'app/components/lazyLoad';

import SearchBar from './searchBar';

class EventsContainer extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization,
    router: PropTypes.object,
  };

  constructor(props) {
    super(props);

    this.state = {};
  }

  handleSearch = query => {
    const {router, location} = this.props;
    router.push({
      pathname: location.pathname,
      query: getParams({
        ...(location.query || {}),
        query,
      }),
    });
  };

  render() {
    const {organization, location, children, ...props} = this.props;

    const hasEventsV2 = new Set(organization.features).has('events-v2');

    if (hasEventsV2) {
      return (
        <LazyLoad
          component={() =>
            import(/* webpackChunkName: "OrganizationEventsV2" */ 'app/views/organizationEventsV2').then(
              mod => mod.default
            )
          }
          organization={organization}
          location={location}
          {...props}
        />
      );
    }

    return (
      <Feature features={['events']} hookName="events-page" renderDisabled>
        <GlobalSelectionHeader
          organization={organization}
          resetParamsOnChange={['cursor']}
        />
        <PageContent>
          <NoProjectMessage organization={organization}>
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
          </NoProjectMessage>
        </PageContent>
      </Feature>
    );
  }
}
export default withOrganization(withGlobalSelection(EventsContainer));
export {EventsContainer};

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
