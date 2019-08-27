import React from 'react';
import DocumentTitle from 'react-document-title';
import PropTypes from 'prop-types';
import styled from 'react-emotion';
import * as ReactRouter from 'react-router';
import {Params} from 'react-router/lib/Router';
import {Location} from 'history';

import {Organization} from 'app/types';
import {t} from 'app/locale';
import SentryTypes from 'app/sentryTypes';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import {PageContent, PageHeader} from 'app/styles/organization';
import PageHeading from 'app/components/pageHeading';
import BetaTag from 'app/components/betaTag';
import Feature from 'app/components/acl/feature';
import Link from 'app/components/links/link';
import NoProjectMessage from 'app/components/noProjectMessage';
import space from 'app/styles/space';
import withOrganization from 'app/utils/withOrganization';

import Events from './events';
import EventDetails from './eventDetails';
import {getCurrentView, getFirstQueryString} from './utils';
import {ALL_VIEWS} from './data';
import EventView from './eventView';

type Props = {
  organization: Organization;
  location: Location;
  router: ReactRouter.InjectedRouter;
  params: Params;
};

class OrganizationEventsV2 extends React.Component<Props> {
  static propTypes: any = {
    organization: SentryTypes.Organization.isRequired,
    location: PropTypes.object.isRequired,
    router: PropTypes.object.isRequired,
  };

  renderQueryList() {
    const {location} = this.props;

    const list = ALL_VIEWS.map((eventViewv1, index) => {
      const eventView = EventView.fromEventViewv1(eventViewv1);

      const name = eventViewv1.name;

      const to = {
        pathname: location.pathname,
        query: {
          ...location.query,
          name,
          ...eventView.generateQueryStringObject(),
        },
      };

      return (
        <LinkContainer key={index}>
          <Link to={to}>{name}</Link>
        </LinkContainer>
      );
    });

    return <LinkList>{list}</LinkList>;
  }

  getEventViewName = () => {
    const {location} = this.props;

    const name = getFirstQueryString(location.query, 'name');

    if (typeof name === 'string' && String(name).trim().length > 0) {
      return `${t('Events')} \u2014 ${String(name).trim()}`;
    }

    return t('Events');
  };

  render() {
    const {organization, location, router} = this.props;
    const eventSlug = getFirstQueryString(location.query, 'eventSlug');
    const view = getFirstQueryString(location.query, 'view');

    const currentView = getCurrentView(view);
    const hasQuery =
      location.query.field || location.query.eventSlug || location.query.view;

    return (
      <Feature features={['events-v2']} organization={organization} renderDisabled>
        <DocumentTitle title={`Events - ${organization.slug} - Sentry`}>
          <React.Fragment>
            <GlobalSelectionHeader organization={organization} />
            <PageContent>
              <NoProjectMessage organization={organization}>
                <PageHeader>
                  <PageHeading>
                    {this.getEventViewName()} <BetaTag />
                  </PageHeading>
                </PageHeader>
                {!hasQuery && this.renderQueryList()}
                {hasQuery && (
                  <Events
                    organization={organization}
                    view={currentView}
                    location={location}
                    router={router}
                  />
                )}
                {hasQuery && eventSlug && (
                  <EventDetails
                    organization={organization}
                    params={this.props.params}
                    eventSlug={eventSlug}
                    view={currentView}
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

export default withOrganization(OrganizationEventsV2);
export {OrganizationEventsV2};
