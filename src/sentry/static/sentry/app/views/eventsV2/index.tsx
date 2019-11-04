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
import theme from 'app/utils/theme';
import {Organization} from 'app/types';
import localStorage from 'app/utils/localStorage';
import withOrganization from 'app/utils/withOrganization';

import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import PageHeading from 'app/components/pageHeading';
import Banner from 'app/components/banner';
import Button from 'app/components/button';
import BetaTag from 'app/components/betaTag';
import Feature from 'app/components/acl/feature';
import Link from 'app/components/links/link';
import NoProjectMessage from 'app/components/noProjectMessage';

import {PageContent, PageHeader} from 'app/styles/organization';
import space from 'app/styles/space';

import Events from './events';
import EventDetails from './eventDetails';
import SavedQueryButtonGroup from './savedQuery';
import EventView from './eventView';
import EventInputName from './eventInputName';
import {getFirstQueryString} from './utils';
import {ALL_VIEWS, TRANSACTION_VIEWS} from './data';

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

  renderQueryList() {
    const {location, organization} = this.props;
    let views = ALL_VIEWS;
    if (organization.features.includes('transaction-events')) {
      views = [...ALL_VIEWS, ...TRANSACTION_VIEWS];
    }

    const list = views.map((eventViewv1, index) => {
      const eventView = EventView.fromEventViewv1(eventViewv1);
      const to = {
        pathname: location.pathname,
        query: {
          ...location.query,
          ...eventView.generateQueryStringObject(),
        },
      };

      return (
        <LinkContainer key={index}>
          <Link
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
            {eventView.name}
          </Link>
        </LinkContainer>
      );
    });

    return <LinkList>{list}</LinkList>;
  }

  renderBanner() {
    const bannerDismissed = localStorage.getItem('discover-banner-dismissed');

    if (bannerDismissed) {
      return null;
    } else {
      return (
        <Banner
          title={t('Discover')}
          subtitle={t('Here are a few sample queries to kick things off')}
          onCloseClick={this.handleClick}
        >
          <BannerButton icon="icon-circle-add">
            {t('Users who error in < 1 min')}
          </BannerButton>
          <BannerButton icon="icon-circle-add">{t('Browsers by most bugs')}</BannerButton>
          <BannerButton icon="icon-circle-add">
            {t('Slowest HTTP endpoints')}
          </BannerButton>
        </Banner>
      );
    }
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
                {!hasQuery && this.renderBanner()}
                {!hasQuery && this.renderQueryList()}
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

const BannerButton = styled(Button)`
  margin: ${space(1)} 0;

  @media (min-width: ${theme.breakpoints[1]}) {
    margin: 0 ${space(1)};
  }
`;

const LinkList = styled('ul')`
  list-style: none;
  padding: 0;
  margin: 0;
`;
const LinkContainer = styled('li')`
  background: ${p => p.theme.white};
  line-height: 1.4;
  border: 1px solid ${p => p.theme.borderLight};
  border-radius: ${p => p.theme.borderRadius};
  margin-bottom: ${space(1)};
  padding: ${space(1)};
`;

// Wrapper is needed because BetaTag discards margins applied directly to it
const BetaTagWrapper = styled('span')`
  margin-right: 0.4em;
`;

export default withOrganization(EventsV2);
export {EventsV2};
