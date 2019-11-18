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

import {PageContent, PageHeader} from 'app/styles/organization';
import space from 'app/styles/space';
import withOrganization from 'app/utils/withOrganization';

import Events from './events';
import SavedQueryButtonGroup from './savedQuery';
import EventView from './eventView';
import EventInputName from './eventInputName';
import {DEFAULT_EVENT_VIEW} from './data';
import QueryList from './queryList';
import DiscoverBreadcrumb from './breadcrumb';
import {generateTitle} from './utils';

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
  };

  shouldReload = true;

  getEndpoints(): [string, string, any][] {
    const {organization} = this.props;
    return [
      [
        'savedQueries',
        `/organizations/${organization.slug}/discover/saved/`,
        {query: {query: 'version:2'}},
      ],
    ];
  }

  componentDidUpdate() {
    const isBannerHidden = checkIsBannerHidden();
    if (isBannerHidden !== this.state.isBannerHidden) {
      // eslint-disable-next-line react/no-did-update-set-state
      this.setState({
        isBannerHidden,
      });
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

  // When a query is saved we need to re-fetch the
  // saved query list as we don't use a reflux store.
  handleQuerySave = () => {
    this.fetchData({reloading: true});
  };

  renderBanner() {
    const bannerDismissed = this.state.isBannerHidden;

    if (bannerDismissed) {
      return null;
    }

    const eventView = EventView.fromSavedQuery(DEFAULT_EVENT_VIEW);

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
    return (
      <StyledActions>
        <StyledSearchBar />
        <Button priority="primary">{t('Build a new query')}</Button>
      </StyledActions>
    );
  }

  renderNewQuery() {
    const {location, organization} = this.props;
    const {savedQueries} = this.state;

    return (
      <div>
        {this.renderBanner()}
        {DISPLAY_SEARCH_BAR_FLAG && this.renderActions()}
        <QueryList
          savedQueries={savedQueries}
          location={location}
          organization={organization}
        />
      </div>
    );
  }

  renderQueryRename = (hasQuery: boolean, eventView: EventView) => {
    if (!hasQuery) {
      return null;
    }

    const {organization} = this.props;
    const {savedQueries} = this.state;

    return (
      <div>
        <EventInputName
          savedQueries={savedQueries}
          organization={organization}
          eventView={eventView}
          onQuerySave={this.handleQuerySave}
        />
      </div>
    );
  };

  renderBody() {
    const {organization, location, router} = this.props;
    const eventView = EventView.fromLocation(location);
    const {savedQueries, reloading} = this.state;

    const hasQuery = eventView.isValid();

    return (
      <React.Fragment>
        <PageHeader>
          <DiscoverBreadcrumb
            eventView={eventView}
            organization={organization}
            location={location}
          />
          {hasQuery && (
            <SavedQueryButtonGroup
              location={location}
              organization={organization}
              eventView={eventView}
              savedQueries={savedQueries}
              savedQueriesLoading={reloading}
              onQuerySave={this.handleQuerySave}
            />
          )}
        </PageHeader>
        {this.renderQueryRename(hasQuery, eventView)}
        {!hasQuery && this.renderNewQuery()}
        {hasQuery && (
          <Events
            organization={organization}
            location={location}
            router={router}
            eventView={eventView}
          />
        )}
      </React.Fragment>
    );
  }

  render() {
    const {organization, location} = this.props;
    const eventView = EventView.fromLocation(location);

    return (
      <Feature features={['events-v2']} organization={organization} renderDisabled>
        <SentryDocumentTitle
          title={this.getDocumentTitle(eventView)}
          objSlug={organization.slug}
        >
          <React.Fragment>
            <GlobalSelectionHeader organization={organization} />
            <PageContent>
              <NoProjectMessage organization={organization}>
                {super.render()}
              </NoProjectMessage>
            </PageContent>
          </React.Fragment>
        </SentryDocumentTitle>
      </Feature>
    );
  }
}

const StyledActions = styled('div')`
  display: flex;
  margin-bottom: ${space(3)};
`;

const StyledSearchBar = styled(SearchBar)`
  margin-right: ${space(1)};
  flex-grow: 1;
`;

export default withOrganization(DiscoverLanding);
export {DiscoverLanding};
