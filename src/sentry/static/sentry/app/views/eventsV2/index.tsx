import React from 'react';
import DocumentTitle from 'react-document-title';
import PropTypes from 'prop-types';
import styled from 'react-emotion';
import * as ReactRouter from 'react-router';
import {Params} from 'react-router/lib/Router';
import {Location} from 'history';

import {t} from 'app/locale';
import SentryTypes from 'app/sentryTypes';
import {Organization} from 'app/types';
import localStorage from 'app/utils/localStorage';
import withOrganization from 'app/utils/withOrganization';

import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import PageHeading from 'app/components/pageHeading';
import Banner from 'app/components/banner';
import Button from 'app/components/button';
import BetaTag from 'app/components/betaTag';
import Feature from 'app/components/acl/feature';
import SearchBar from 'app/views/events/searchBar';
import NoProjectMessage from 'app/components/noProjectMessage';

import {PageContent, PageHeader} from 'app/styles/organization';
import space from 'app/styles/space';

import Events from './events';
import EventDetails from './eventDetails';
import SavedQueryButtonGroup from './savedQuery';
import EventView from './eventView';
import EventInputName from './eventInputName';
import {getFirstQueryString} from './utils';
import QueryList from './queryList';

const DISPLAY_SEARCH_BAR_FLAG = true;

type Props = {
  organization: Organization;
  location: Location;
  router: ReactRouter.InjectedRouter;
  params: Params;
};

class EventsV2 extends React.Component<Props> {
  static propTypes: any = {
    organization: SentryTypes.Organization.isRequired,
    location: PropTypes.object.isRequired,
    router: PropTypes.object.isRequired,
  };

  state = {
    isBannerHidden: localStorage.getItem('discover-banner-dismissed'),
  };

  getDocumentTitle = (name: string | undefined): Array<string> => {
    return typeof name === 'string' && String(name).trim().length > 0
      ? [String(name).trim(), t('Discover')]
      : [t('Discover')];
  };

  handleClick = () => {
    localStorage.setItem('discover-banner-dismissed', true);
    this.setState({isBannerHidden: true});
  };

  renderBanner() {
    const bannerDismissed = localStorage.getItem('discover-banner-dismissed');

    if (bannerDismissed) {
      return null;
    }

    return (
      <Banner
        title={t('Discover')}
        subtitle={t('Customize your query searches')}
        onCloseClick={this.handleClick}
      >
        <Button>Build a new query</Button>
      </Banner>
    );
  }

  renderActions() {
    return (
      <StyledActions>
        <StyledSearchBar />
        <Button priority="primary">Build a new query</Button>
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

  render() {
    const {organization, location, router} = this.props;

    const eventSlug = getFirstQueryString(location.query, 'eventSlug');
    const eventView = EventView.fromLocation(location);
    const documentTitle = this.getDocumentTitle(eventView.name).join(' - ');

    const hasQuery = location.query.field || location.query.eventSlug;

    return (
      <Feature features={['events-v2']} organization={organization} renderDisabled>
        <DocumentTitle title={`${documentTitle} - ${organization.slug} - Sentry`}>
          <React.Fragment>
            <GlobalSelectionHeader organization={organization} />
            <PageContent>
              <NoProjectMessage organization={organization}>
                <PageHeader>
                  <PageHeading>
                    {t('Discover')}
                    <BetaTagWrapper>
                      <BetaTag />
                    </BetaTagWrapper>
                    {hasQuery && (
                      <React.Fragment>
                        {' \u2014 '}
                        <EventInputName
                          organization={organization}
                          eventView={eventView}
                        />
                      </React.Fragment>
                    )}
                  </PageHeading>

                  {hasQuery && (
                    <SavedQueryButtonGroup
                      location={location}
                      organization={organization}
                      eventView={eventView}
                    />
                  )}
                </PageHeader>
                {!hasQuery && this.renderNewQuery()}
                {hasQuery && (
                  <Events
                    organization={organization}
                    location={location}
                    router={router}
                    eventView={eventView}
                  />
                )}
                {hasQuery && eventSlug && (
                  <EventDetails
                    organization={organization}
                    params={this.props.params}
                    eventSlug={eventSlug}
                    eventView={eventView}
                    location={location}
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

// Wrapper is needed because BetaTag discards margins applied directly to it
const BetaTagWrapper = styled('span')`
  margin-right: 0.4em;
`;

export default withOrganization(EventsV2);
export {EventsV2};
