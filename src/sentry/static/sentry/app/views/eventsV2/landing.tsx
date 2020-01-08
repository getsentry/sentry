import React from 'react';
import PropTypes from 'prop-types';
import styled from 'react-emotion';
import * as ReactRouter from 'react-router';
import {Params} from 'react-router/lib/Router';
import {Location} from 'history';
import pick from 'lodash/pick';
import isEqual from 'lodash/isEqual';

import {t} from 'app/locale';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import SentryTypes from 'app/sentryTypes';
import {Organization, SavedQuery} from 'app/types';
import localStorage from 'app/utils/localStorage';
import AsyncComponent from 'app/components/asyncComponent';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import Banner from 'app/components/banner';
import Button from 'app/components/button';
import SearchBar from 'app/components/searchBar';
import NoProjectMessage from 'app/components/noProjectMessage';

import {PageContent} from 'app/styles/organization';
import space from 'app/styles/space';
import withOrganization from 'app/utils/withOrganization';

import EventView from './eventView';
import {DEFAULT_EVENT_VIEW} from './data';
import QueryList from './queryList';
import {getPrebuiltQueries, decodeScalar} from './utils';
import {generateDiscoverResultsRoute} from './results';

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

    const to = {
      pathname: `/organizations/${organization.slug}/eventsV2/results`,
      query: {
        ...eventView.generateQueryStringObject(),
      },
    };

    return (
      <Banner
        title={t('Discover')}
        subtitle={t('Customize your query searches')}
        onCloseClick={this.handleClick}
      >
        <Button
          to={to}
          onClick={() => {
            trackAnalyticsEvent({
              eventKey: 'discover_v2.prebuilt_query_click',
              eventName: 'Discoverv2: Click a pre-built query',
              organization_id: this.props.organization.id,
              query_name: eventView.name,
            });
          }}
        >
          {t('Build a new query')}
        </Button>
      </Banner>
    );
  }

  renderActions() {
    const {location, organization} = this.props;

    const eventView = EventView.fromNewQueryWithLocation(DEFAULT_EVENT_VIEW, location);

    const to = {
      pathname: generateDiscoverResultsRoute(organization.slug),
      query: {
        ...eventView.generateQueryStringObject(),
      },
    };

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
        </PageContent>
      );
    }

    return (
      <SentryDocumentTitle title={t('Discover')} objSlug={organization.slug}>
        <React.Fragment>
          <GlobalSelectionHeader organization={organization} />
          <NoProjectMessage organization={organization}>{body}</NoProjectMessage>
        </React.Fragment>
      </SentryDocumentTitle>
    );
  }
}

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

export default withOrganization(DiscoverLanding);
export {DiscoverLanding};
