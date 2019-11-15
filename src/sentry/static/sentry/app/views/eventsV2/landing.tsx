import React from 'react';
import DocumentTitle from 'react-document-title';
import PropTypes from 'prop-types';
import styled from 'react-emotion';
import * as ReactRouter from 'react-router';
import {Params} from 'react-router/lib/Router';
import {Location} from 'history';

import {t} from 'app/locale';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import SentryTypes from 'app/sentryTypes';
import {Organization} from 'app/types';
import localStorage from 'app/utils/localStorage';
import withOrganization from 'app/utils/withOrganization';

import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import Banner from 'app/components/banner';
import Button from 'app/components/button';
import Feature from 'app/components/acl/feature';
import SearchBar from 'app/views/events/searchBar';
import NoProjectMessage from 'app/components/noProjectMessage';

import {PageContent, PageHeader} from 'app/styles/organization';
import space from 'app/styles/space';

import Events from './events';
import SavedQueryButtonGroup from './savedQuery';
import EventView from './eventView';
import EventInputName from './eventInputName';
import {DEFAULT_EVENT_VIEW_V1} from './data';
import QueryList from './queryList';
import DiscoverBreadcrumb from './breadcrumb';

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
};

class DiscoverLanding extends React.Component<Props> {
  static propTypes: any = {
    organization: SentryTypes.Organization.isRequired,
    location: PropTypes.object.isRequired,
    router: PropTypes.object.isRequired,
  };

  state = {
    isBannerHidden: checkIsBannerHidden(),
  };

  componentDidUpdate() {
    const isBannerHidden = checkIsBannerHidden();
    if (isBannerHidden !== this.state.isBannerHidden) {
      this.setState({
        isBannerHidden,
      });
    }
  }

  getDocumentTitle = (name: string | undefined): Array<string> => {
    return typeof name === 'string' && String(name).trim().length > 0
      ? [String(name).trim(), t('Discover')]
      : [t('Discover')];
  };

  handleClick = () => {
    localStorage.setItem(BANNER_DISMISSED_KEY, 'true');
    this.setState({isBannerHidden: true});
  };

  renderBanner() {
    const bannerDismissed = this.state.isBannerHidden;

    if (bannerDismissed) {
      return null;
    }

    const eventView = EventView.fromEventViewv1(DEFAULT_EVENT_VIEW_V1);

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

    return (
      <div>
        {this.renderBanner()}
        {DISPLAY_SEARCH_BAR_FLAG && this.renderActions()}
        <QueryList location={location} organization={organization} />
      </div>
    );
  }

  renderQueryRename = (hasQuery: boolean, eventView: EventView) => {
    if (!hasQuery) {
      return null;
    }

    const {organization} = this.props;

    return (
      <div>
        <EventInputName organization={organization} eventView={eventView} />
      </div>
    );
  };

  render() {
    const {organization, location, router} = this.props;
    const eventView = EventView.fromLocation(location);
    const documentTitle = this.getDocumentTitle(eventView.name).join(' - ');

    const hasQuery = eventView.isValid();

    return (
      <Feature features={['events-v2']} organization={organization} renderDisabled>
        <DocumentTitle title={`${documentTitle} - ${organization.slug} - Sentry`}>
          <React.Fragment>
            <GlobalSelectionHeader organization={organization} />
            <PageContent>
              <NoProjectMessage organization={organization}>
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
              </NoProjectMessage>
            </PageContent>
          </React.Fragment>
        </DocumentTitle>
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
