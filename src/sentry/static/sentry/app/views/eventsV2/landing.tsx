import React from 'react';
import PropTypes from 'prop-types';
import styled from 'react-emotion';
import * as ReactRouter from 'react-router';
import {Params} from 'react-router/lib/Router';
import {Location} from 'history';

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
import Feature from 'app/components/acl/feature';
import SearchBar from 'app/views/events/searchBar';
import NoProjectMessage from 'app/components/noProjectMessage';

import {PageContent} from 'app/styles/organization';
import space from 'app/styles/space';
import withOrganization from 'app/utils/withOrganization';

import Events from './events';
import SavedQueryButtonGroup from './savedQuery';
import EventView from './eventView';
import EventInputName from './eventInputName';
import {DEFAULT_EVENT_VIEW} from './data';
import QueryList from './queryList';
import DiscoverBreadcrumb from './breadcrumb';
import {getPrebuiltQueries, generateTitle} from './utils';

const DISPLAY_SEARCH_BAR_FLAG = false;
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
  savedQueries: SavedQuery[];
  savedQueriesPageLinks: string;
} & AsyncComponent['state'];

class DiscoverLanding extends AsyncComponent<Props, State> {
  static propTypes: any = {
    organization: SentryTypes.Organization.isRequired,
    location: PropTypes.object.isRequired,
    router: PropTypes.object.isRequired,
  };

  state = {
    loading: true,
    reloading: false,
    error: false,
    errors: [],
    isBannerHidden: checkIsBannerHidden(),
    savedQueries: [],
    savedQueriesPageLinks: '',
  };

  shouldReload = true;

  getEndpoints(): [string, string, any][] {
    const {organization, location} = this.props;
    const views = getPrebuiltQueries(organization);
    const cursor = location.query.cursor;
    // XXX(mark) Pagination here is a bit wonky as we include the pre-built queries
    // on the first page and aim to always have 9 results showing. If there are more than
    // 9 pre-built queries we'll have more results on the first page. Furthermore, going
    // back and forth between the first and second page is non-determinsitic due to the shifting
    // per_page value.
    let perPage = 9;
    if (!cursor) {
      perPage = Math.max(1, perPage - views.length);
    }

    const queryParams = {
      cursor,
      query: 'version:2',
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

    if (prevProps.location.query.cursor !== this.props.location.query.cursor) {
      this.fetchData();
    }
  }

  getDocumentTitle = (eventView: EventView): string => {
    return generateTitle({
      eventView,
    });
  };

  handleClick = () => {
    localStorage.setItem(BANNER_DISMISSED_KEY, 'true');
    this.setState({isBannerHidden: true});
  };

  // When a query is saved or deleted we need to re-fetch the
  // saved query list as we don't use a reflux store.
  handleQueryChange = () => {
    this.fetchData({reloading: true});
  };

  renderBanner() {
    const bannerDismissed = this.state.isBannerHidden;

    if (bannerDismissed) {
      return null;
    }

    const {location} = this.props;

    const eventView = EventView.fromSavedQueryWithLocation(DEFAULT_EVENT_VIEW, location);

    const to = {
      pathname: location.pathname,
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
    const StyledSearchBar = styled(SearchBar)`
      margin-right: ${space(1)};
      flex-grow: 1;
    `;

    const StyledActions = styled('div')`
      display: flex;
      margin-bottom: ${space(3)};
    `;

    return (
      <StyledActions>
        <StyledSearchBar />
        <Button priority="primary">{t('Build a new query')}</Button>
      </StyledActions>
    );
  }

  renderQueryList() {
    const {location, organization} = this.props;
    const {loading, savedQueries, savedQueriesPageLinks} = this.state;
    const StyledPageHeader = styled('div')`
      display: flex;
      align-items: center;
      font-size: ${p => p.theme.headerFontSize};
      color: ${p => p.theme.gray4};
      height: 40px;
      margin-bottom: ${space(1)};
    `;

    return (
      <PageContent>
        <StyledPageHeader>{t('Discover')}</StyledPageHeader>
        {this.renderBanner()}
        {DISPLAY_SEARCH_BAR_FLAG && this.renderActions()}
        {loading && this.renderLoading()}
        {!loading && (
          <QueryList
            pageLinks={savedQueriesPageLinks}
            savedQueries={savedQueries}
            location={location}
            organization={organization}
            onQueryChange={this.handleQueryChange}
          />
        )}
      </PageContent>
    );
  }

  renderResults(eventView: EventView) {
    const {organization, location, router} = this.props;
    const {savedQueries, reloading} = this.state;
    const ContentBox = styled(PageContent)`
      margin: 0;

      @media (min-width: ${p => p.theme.breakpoints[1]}) {
        display: grid;
        grid-template-rows: 1fr auto;
        grid-template-columns: 70% auto;
        grid-column-gap: ${space(3)};
      }
    `;

    const HeaderBox = styled(ContentBox)`
      background-color: ${p => p.theme.white};
      border-bottom: 1px solid ${p => p.theme.borderDark};
      grid-row-gap: ${space(1)};
    `;

    const Controller = styled('div')`
      justify-self: end;
      grid-row: 1/3;
      grid-column: 2/3;
    `;

    return (
      <div>
        <HeaderBox>
          <DiscoverBreadcrumb
            eventView={eventView}
            organization={organization}
            location={location}
          />
          <EventInputName
            savedQueries={savedQueries}
            organization={organization}
            eventView={eventView}
            onQueryChange={this.handleQueryChange}
          />
          <Controller>
            <SavedQueryButtonGroup
              location={location}
              organization={organization}
              eventView={eventView}
              savedQueries={savedQueries}
              savedQueriesLoading={reloading}
              onQueryChange={this.handleQueryChange}
            />
          </Controller>
        </HeaderBox>
        <ContentBox>
          <Events
            organization={organization}
            location={location}
            router={router}
            eventView={eventView}
          />
        </ContentBox>
      </div>
    );
  }

  render() {
    const {organization, location} = this.props;
    const eventView = EventView.fromLocation(location);
    const hasQuery = eventView.isValid();

    return (
      <Feature features={['events-v2']} organization={organization} renderDisabled>
        <SentryDocumentTitle
          title={this.getDocumentTitle(eventView)}
          objSlug={organization.slug}
        >
          <React.Fragment>
            <GlobalSelectionHeader organization={organization} />
            <NoProjectMessage organization={organization}>
              {!hasQuery && this.renderQueryList()}
              {hasQuery && this.renderResults(eventView)}
            </NoProjectMessage>
          </React.Fragment>
        </SentryDocumentTitle>
      </Feature>
    );
  }
}

export default withOrganization(DiscoverLanding);
export {DiscoverLanding};
