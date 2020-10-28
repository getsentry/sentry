import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';

import {loadOrganizationTags} from 'app/actionCreators/tags';
import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';
import {t} from 'app/locale';
import FeatureBadge from 'app/components/featureBadge';
import Feature from 'app/components/acl/feature';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import LightWeightNoProjectMessage from 'app/components/lightWeightNoProjectMessage';
import SentryTypes from 'app/sentryTypes';
import PageHeading from 'app/components/pageHeading';
import withApi from 'app/utils/withApi';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import withOrganization from 'app/utils/withOrganization';
import {PageContent, PageHeader} from 'app/styles/organization';
import space from 'app/styles/space';

import SearchBar from './searchBar';

class EventsContainer extends React.Component {
  static propTypes = {
    api: PropTypes.object,
    organization: SentryTypes.Organization,
    router: PropTypes.object,
    selection: SentryTypes.GlobalSelection,
  };

  componentDidMount() {
    const {api, organization, selection} = this.props;
    loadOrganizationTags(api, organization.slug, selection);
  }

  componentDidUpdate(prevProps) {
    const {api, organization, selection} = this.props;

    if (
      !isEqual(prevProps.selection.projects, selection.projects) ||
      !isEqual(prevProps.selection.datetime, selection.datetime)
    ) {
      loadOrganizationTags(api, organization.slug, selection);
    }
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
    const {organization, location, children, selection} = this.props;

    return (
      <Feature
        features={['events']}
        hookName="feature-disabled:events-page"
        renderDisabled
      >
        <GlobalSelectionHeader resetParamsOnChange={['cursor']}>
          <PageContent>
            <LightWeightNoProjectMessage organization={organization}>
              <Body>
                <PageHeader>
                  <HeaderTitle>
                    {t('Events')} <FeatureBadge type="beta" />
                  </HeaderTitle>
                </PageHeader>
                <div>
                  <StyledSearchBar
                    organization={organization}
                    projectIds={selection.projects}
                    query={(location.query && location.query.query) || ''}
                    placeholder={t(
                      'Search for events, users, tags, and everything else.'
                    )}
                    onSearch={this.handleSearch}
                  />
                </div>
                {children}
              </Body>
            </LightWeightNoProjectMessage>
          </PageContent>
        </GlobalSelectionHeader>
      </Feature>
    );
  }
}
export default withApi(withOrganization(withGlobalSelection(EventsContainer)));
export {EventsContainer};

const Body = styled('div')`
  background-color: ${p => p.theme.gray100};
  flex-direction: column;
  flex: 1;
`;

const HeaderTitle = styled(PageHeading)`
  flex: 1;
`;

const StyledSearchBar = styled(SearchBar)`
  flex: 1;
  margin-bottom: ${space(2)};
`;
