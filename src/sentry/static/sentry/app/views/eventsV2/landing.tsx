import {Params} from 'react-router/lib/Router';
import PropTypes from 'prop-types';
import React from 'react';
import * as ReactRouter from 'react-router';
import isEqual from 'lodash/isEqual';
import pick from 'lodash/pick';
import styled from '@emotion/styled';

import {Location} from 'history';
import {Organization, SavedQuery} from 'app/types';
import {PageContent} from 'app/styles/organization';
import {t} from 'app/locale';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import Alert from 'app/components/alert';
import AsyncComponent from 'app/components/asyncComponent';
import Banner from 'app/components/banner';
import Button from 'app/components/button';
import ConfigStore from 'app/stores/configStore';
import Feature from 'app/components/acl/feature';
import NoProjectMessage from 'app/components/noProjectMessage';
import SearchBar from 'app/components/searchBar';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import SentryTypes from 'app/sentryTypes';
import localStorage from 'app/utils/localStorage';
import space from 'app/styles/space';
import withOrganization from 'app/utils/withOrganization';

import {DEFAULT_EVENT_VIEW} from './data';
import {getPrebuiltQueries, decodeScalar} from './utils';
import EventView from './eventView';
import QueryList from './queryList';
import backgroundSpace from '../../../images/spot/background-space.svg';

const BANNER_DISMISSED_KEY = 'discover-banner-dismissed';

function checkIsBannerHidden(): boolean {
  return localStorage.getItem(BANNER_DISMISSED_KEY) === 'true';
}

type Props = {
  organization: Organization;
  location: Location;
  router: ReactRouter.InjectedRouter;
  params: Params;
} & AsyncComponent['props'];

type State = {
  isBannerHidden: boolean;
  savedQueries: SavedQuery[];
  savedQueriesPageLinks: string;
} & AsyncComponent['state'];

class DiscoverLanding extends AsyncComponent<Props, State> {
  static propTypes: any = {
    organization: SentryTypes.Organization.isRequired,
    location: PropTypes.object.isRequired,
    router: PropTypes.object.isRequired,
  };

  state: State = {
    // AsyncComponent state
    loading: true,
    reloading: false,
    error: false,
    errors: [],

    // local component state
    isBannerHidden: checkIsBannerHidden(),
    savedQueries: [],
    savedQueriesPageLinks: '',
  };

  shouldReload = true;

  getSavedQuerySearchQuery(): string {
    const {location} = this.props;

    return String(decodeScalar(location.query.query) || '').trim();
  }

  getEndpoints(): [string, string, any][] {
    const {organization, location} = this.props;

    const views = getPrebuiltQueries(organization);
    const searchQuery = this.getSavedQuerySearchQuery();

    const cursor = decodeScalar(location.query.cursor);
    let perPage = 9;
    if (!cursor) {
      // invariant: we're on the first page

      if (searchQuery && searchQuery.length > 0) {
        const needleSearch = searchQuery.toLowerCase();

        const numOfPrebuiltQueries = views.reduce((sum, view) => {
          const eventView = EventView.fromNewQueryWithLocation(view, location);

          // if a search is performed on the list of queries, we filter
          // on the pre-built queries
          if (eventView.name && eventView.name.toLowerCase().includes(needleSearch)) {
            return sum + 1;
          }

          return sum;
        }, 0);

        perPage = Math.max(1, perPage - numOfPrebuiltQueries);
      } else {
        perPage = Math.max(1, perPage - views.length);
      }
    }

    const queryParams = {
      cursor,
      query: `version:2 name:"${searchQuery}"`,
      per_page: perPage,
      sortBy: '-dateUpdated',
    };
    if (!cursor) {
      delete queryParams.cursor;
    }

    return [
      [
        'savedQueries',
        `/organizations/${organization.slug}/discover/saved/`,
        {
          query: queryParams,
        },
      ],
    ];
  }

  componentDidUpdate(prevProps: Props) {
    const isBannerHidden = checkIsBannerHidden();
    if (isBannerHidden !== this.state.isBannerHidden) {
      // eslint-disable-next-line react/no-did-update-set-state
      this.setState({
        isBannerHidden,
      });
    }

    const PAYLOAD_KEYS = ['cursor', 'query'] as const;

    const payloadKeysChanged = !isEqual(
      pick(prevProps.location.query, PAYLOAD_KEYS),
      pick(this.props.location.query, PAYLOAD_KEYS)
    );

    // if any of the query strings relevant for the payload has changed,
    // we re-fetch data
    if (payloadKeysChanged) {
      this.fetchData();
    }
  }

  handleQueryChange = () => {
    this.fetchData({reloading: true});
  };

  handleClick = () => {
    localStorage.setItem(BANNER_DISMISSED_KEY, 'true');
    this.setState({isBannerHidden: true});
  };

  handleSearchQuery = (searchQuery: string) => {
    const {location} = this.props;
    ReactRouter.browserHistory.push({
      pathname: location.pathname,
      query: {
        ...location.query,
        cursor: undefined,
        query: String(searchQuery).trim() || undefined,
      },
    });
  };

  renderBanner() {
    const bannerDismissed = this.state.isBannerHidden;

    if (bannerDismissed) {
      return null;
    }

    const {location, organization} = this.props;
    const eventView = EventView.fromNewQueryWithLocation(DEFAULT_EVENT_VIEW, location);
    const to = eventView.getResultsViewUrlTarget(organization.slug);

    return (
      <Banner
        title={t('Discover Trends')}
        subtitle={t(
          'Customize and save queries by search conditions, event fields, and tags'
        )}
        backgroundImg={backgroundSpace}
        onCloseClick={this.handleClick}
      >
        <StarterButton
          to={to}
          onClick={() => {
            trackAnalyticsEvent({
              eventKey: 'discover_v2.prebuilt_query_click',
              eventName: 'Discoverv2: Click a pre-built query',
              organization_id: parseInt(this.props.organization.id, 10),
              query_name: eventView.name,
            });
          }}
        >
          {t('Build a new query')}
        </StarterButton>
        <StarterButton href="https://docs.sentry.io/workflow/discover2/">
          {t('Read the docs')}
        </StarterButton>
      </Banner>
    );
  }

  renderActions() {
    const {location, organization} = this.props;

    const eventView = EventView.fromNewQueryWithLocation(DEFAULT_EVENT_VIEW, location);
    const to = eventView.getResultsViewUrlTarget(organization.slug);

    return (
      <StyledActions>
        <StyledSearchBar
          defaultQuery=""
          query={this.getSavedQuerySearchQuery()}
          placeholder={t('Search for saved queries')}
          onSearch={this.handleSearchQuery}
        />
        <StyledOr>or</StyledOr>
        <StyledButton data-test-id="build-new-query" to={to} priority="primary">
          {t('Build a new query')}
        </StyledButton>
      </StyledActions>
    );
  }

  onGoLegacyDiscover = () => {
    localStorage.setItem('discover:version', '1');
    const user = ConfigStore.get('user');
    trackAnalyticsEvent({
      eventKey: 'discover_v2.opt_out',
      eventName: 'Discoverv2: Go to discover',
      organization_id: parseInt(this.props.organization.id, 10),
      user_id: parseInt(user.id, 10),
    });
  };

  renderNoAccess() {
    return (
      <PageContent>
        <Alert type="warning">{t("You don't have access to this feature")}</Alert>
      </PageContent>
    );
  }

  render() {
    let body;
    const {location, organization} = this.props;
    const {loading, savedQueries, savedQueriesPageLinks, error} = this.state;
    if (loading) {
      body = this.renderLoading();
    } else if (error) {
      body = this.renderError();
    } else {
      body = (
        <PageContent>
          <StyledPageHeader>{t('Discover')}</StyledPageHeader>
          {this.renderBanner()}
          {this.renderActions()}
          <QueryList
            pageLinks={savedQueriesPageLinks}
            savedQueries={savedQueries}
            savedQuerySearchQuery={this.getSavedQuerySearchQuery()}
            location={location}
            organization={organization}
            onQueryChange={this.handleQueryChange}
          />
          <Feature features={['organizations:discover']} organization={organization}>
            <SwitchLink
              href={`/organizations/${organization.slug}/discover/`}
              onClick={this.onGoLegacyDiscover}
            >
              {t('Go to Legacy Discover')}
            </SwitchLink>
          </Feature>
        </PageContent>
      );
    }

    return (
      <Feature
        organization={organization}
        features={['discover-query']}
        renderDisabled={this.renderNoAccess}
      >
        <SentryDocumentTitle title={t('Discover')} objSlug={organization.slug}>
          <StyledPageContent>
            <NoProjectMessage organization={organization}>{body}</NoProjectMessage>
          </StyledPageContent>
        </SentryDocumentTitle>
      </Feature>
    );
  }
}

const StyledPageContent = styled(PageContent)`
  padding: 0;
`;

const StyledPageHeader = styled('div')`
  display: flex;
  align-items: center;
  font-size: ${p => p.theme.headerFontSize};
  color: ${p => p.theme.gray4};
  height: 40px;
  margin-bottom: ${space(1)};
`;

const StyledSearchBar = styled(SearchBar)`
  flex-grow: 1;
`;

const StyledOr = styled('span')`
  color: ${p => p.theme.gray2};
  font-size: ${p => p.theme.fontSizeMedium};
  margin: 0 ${space(1.5)};
`;

const StyledActions = styled('div')`
  display: flex;
  align-items: center;
  margin-bottom: ${space(3)};
`;

const StyledButton = styled(Button)`
  white-space: nowrap;
`;

const StarterButton = styled(Button)`
  margin: ${space(1)};
`;

const SwitchLink = styled('a')`
  font-size: ${p => p.theme.fontSizeSmall};
  margin-left: ${space(1)};
`;

export default withOrganization(DiscoverLanding);
export {DiscoverLanding};
