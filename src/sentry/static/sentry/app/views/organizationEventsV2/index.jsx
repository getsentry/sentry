import React from 'react';
import DocumentTitle from 'react-document-title';
import PropTypes from 'prop-types';

import {t} from 'app/locale';
import SentryTypes from 'app/sentryTypes';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import {PageContent, PageHeader} from 'app/styles/organization';
import PageHeading from 'app/components/pageHeading';
import BetaTag from 'app/components/betaTag';
import NavTabs from 'app/components/navTabs';
import ListLink from 'app/components/links/listLink';
import NoProjectMessage from 'app/components/noProjectMessage';

import Events from './events';
import EventDetails from './eventDetails';
import {ALL_VIEWS} from './data';
import {getCurrentView} from './utils';

export default class OrganizationEventsV2 extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization.isRequired,
    location: PropTypes.object.isRequired,
    router: PropTypes.object.isRequired,
  };

  renderTabs() {
    const {organization} = this.props;
    const currentView = getCurrentView(this.props.location.query.view);

    return (
      <NavTabs underlined={true}>
        {ALL_VIEWS.map(view => (
          <ListLink
            key={view.id}
            to={{
              pathname: `/organizations/${organization.slug}/events/`,
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
    const {eventSlug} = location.query;
    const currentView = getCurrentView(location.query.view);

    return (
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
    );
  }
}
