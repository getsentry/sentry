import React from 'react';
import DocumentTitle from 'react-document-title';
import PropTypes from 'prop-types';
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
import NavTabs from 'app/components/navTabs';
import ListLink from 'app/components/links/listLink';
import NoProjectMessage from 'app/components/noProjectMessage';
import withOrganization from 'app/utils/withOrganization';

import Events from './events';
import EventDetails from './eventDetails';
import {ALL_VIEWS} from './data';
import {getCurrentView, getFirstQueryString} from './utils';

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

  renderTabs(): React.ReactNode {
    const {location} = this.props;
    const firstView = getFirstQueryString(location.query, 'view');
    const currentView = getCurrentView(firstView);

    return (
      <NavTabs underlined={true}>
        {ALL_VIEWS.map(view => (
          <ListLink
            key={view.id}
            to={{
              pathname: location.pathname,
              query: {
                ...this.props.location.query,
                view: view.id,
                cursor: undefined,
                sort: undefined,
              },
            }}
            isActive={() => view.id === currentView.id}
          >
            {view.name}
          </ListLink>
        ))}
      </NavTabs>
    );
  }

  render() {
    const {organization, location, router} = this.props;
    const eventSlug = getFirstQueryString(location.query, 'eventSlug');
    const view = getFirstQueryString(location.query, 'view');

    const currentView = getCurrentView(view);

    return (
      <Feature features={['events-v2']} organization={organization} renderDisabled>
        <DocumentTitle title={`Events - ${organization.slug} - Sentry`}>
          <React.Fragment>
            <GlobalSelectionHeader organization={organization} />
            <PageContent>
              <NoProjectMessage organization={organization}>
                <PageHeader>
                  <PageHeading>
                    {t('Events')} <BetaTag />
                  </PageHeading>
                </PageHeader>
                {this.renderTabs()}
                <Events
                  organization={organization}
                  view={currentView}
                  location={location}
                  router={router}
                />
              </NoProjectMessage>
              {eventSlug && (
                <EventDetails
                  organization={organization}
                  params={this.props.params}
                  eventSlug={eventSlug}
                  view={currentView}
                  location={location}
                />
              )}
            </PageContent>
          </React.Fragment>
        </DocumentTitle>
      </Feature>
    );
  }
}

export default withOrganization(OrganizationEventsV2);
export {OrganizationEventsV2};
