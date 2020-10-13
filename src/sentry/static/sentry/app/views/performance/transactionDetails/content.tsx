import React from 'react';
import {Params} from 'react-router/lib/Router';
import {Location} from 'history';
import PropTypes from 'prop-types';

import {t} from 'app/locale';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import {Organization, Event, EventTag} from 'app/types';
import SentryTypes from 'app/sentryTypes';
import EventMetadata from 'app/components/events/eventMetadata';
import {BorderlessEventEntries} from 'app/components/events/eventEntries';
import * as SpanEntryContext from 'app/components/events/interfaces/spans/context';
import Button from 'app/components/button';
import LoadingError from 'app/components/loadingError';
import NotFound from 'app/components/errors/notFound';
import AsyncComponent from 'app/components/asyncComponent';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import RootSpanStatus from 'app/components/events/rootSpanStatus';
import OpsBreakdown from 'app/components/events/opsBreakdown';
import RealUserMonitoring from 'app/components/events/realUserMonitoring';
import TagsTable from 'app/components/tagsTable';
import Projects from 'app/utils/projects';
import * as Layout from 'app/components/layouts/thirds';
import Breadcrumb from 'app/views/performance/breadcrumb';
import {decodeScalar, appendTagCondition} from 'app/utils/queryString';

import {transactionSummaryRouteWithQuery} from '../transactionSummary/utils';
import {getTransactionDetailsUrl} from '../utils';

type Props = {
  organization: Organization;
  location: Location;
  params: Params;
  eventSlug: string;
};

type State = {
  event: Event | undefined;
  isSidebarVisible: boolean;
} & AsyncComponent['state'];

class EventDetailsContent extends AsyncComponent<Props, State> {
  static propTypes: any = {
    organization: SentryTypes.Organization.isRequired,
    eventSlug: PropTypes.string.isRequired,
    location: PropTypes.object.isRequired,
  };

  state: State = {
    // AsyncComponent state
    loading: true,
    reloading: false,
    error: false,
    errors: [],
    event: undefined,

    // local state
    isSidebarVisible: true,
  };

  toggleSidebar = () => {
    this.setState({isSidebarVisible: !this.state.isSidebarVisible});
  };

  getEndpoints(): Array<[string, string]> {
    const {organization, params} = this.props;
    const {eventSlug} = params;

    const url = `/organizations/${organization.slug}/events/${eventSlug}/`;

    return [['event', url]];
  }

  get projectId() {
    return this.props.eventSlug.split(':')[0];
  }

  generateTagUrl = (tag: EventTag) => {
    const {location, organization} = this.props;
    const {event} = this.state;
    if (!event) {
      return '';
    }
    const query = decodeScalar(location.query.query) || '';
    const newQuery = {
      ...location.query,
      query: appendTagCondition(query, tag.key, tag.value),
    };
    return transactionSummaryRouteWithQuery({
      orgSlug: organization.slug,
      transaction: event.title,
      projectID: decodeScalar(location.query.project),
      query: newQuery,
    });
  };

  renderBody() {
    const {event} = this.state;

    if (!event) {
      return <NotFound />;
    }

    return this.renderContent(event);
  }

  renderContent(event: Event) {
    const {organization, location, eventSlug} = this.props;

    // metrics
    trackAnalyticsEvent({
      eventKey: 'performance.event_details',
      eventName: 'Performance: Opened Event Details',
      event_type: event.type,
      organization_id: parseInt(organization.id, 10),
    });

    const {isSidebarVisible} = this.state;
    const transactionName = event.title;
    const query = decodeScalar(location.query.query) || '';

    return (
      <React.Fragment>
        <Layout.Header>
          <Layout.HeaderContent>
            <Breadcrumb
              organization={organization}
              location={location}
              transactionName={transactionName}
              eventSlug={eventSlug}
            />
            <Layout.Title data-test-id="event-header">{event.title}</Layout.Title>
          </Layout.HeaderContent>
          <Layout.HeaderActions>
            <Button onClick={this.toggleSidebar}>
              {isSidebarVisible ? 'Hide Details' : 'Show Details'}
            </Button>
          </Layout.HeaderActions>
        </Layout.Header>
        <Layout.Body>
          <Layout.Main fullWidth={!isSidebarVisible}>
            <Projects orgId={organization.slug} slugs={[this.projectId]}>
              {({projects}) => (
                <SpanEntryContext.Provider
                  value={{
                    getViewChildTransactionTarget: childTransactionProps => {
                      return getTransactionDetailsUrl(
                        organization,
                        childTransactionProps.eventSlug,
                        childTransactionProps.transaction,
                        location.query
                      );
                    },
                  }}
                >
                  <BorderlessEventEntries
                    organization={organization}
                    event={event}
                    project={projects[0]}
                    showExampleCommit={false}
                    showTagSummary={false}
                    location={location}
                  />
                </SpanEntryContext.Provider>
              )}
            </Projects>
          </Layout.Main>
          {isSidebarVisible && (
            <Layout.Side>
              <EventMetadata
                event={event}
                organization={organization}
                projectId={this.projectId}
              />
              <RootSpanStatus event={event} />
              <OpsBreakdown event={event} />
              <RealUserMonitoring organization={organization} event={event} />
              <TagsTable event={event} query={query} generateUrl={this.generateTagUrl} />
            </Layout.Side>
          )}
        </Layout.Body>
      </React.Fragment>
    );
  }

  renderError(error: Error) {
    const notFound = Object.values(this.state.errors).find(
      resp => resp && resp.status === 404
    );
    const permissionDenied = Object.values(this.state.errors).find(
      resp => resp && resp.status === 403
    );

    if (notFound) {
      return <NotFound />;
    }
    if (permissionDenied) {
      return (
        <LoadingError message={t('You do not have permission to view that event.')} />
      );
    }

    return super.renderError(error, true, true);
  }

  renderComponent() {
    const {organization} = this.props;

    return (
      <SentryDocumentTitle
        title={t('Performance - Event Details')}
        objSlug={organization.slug}
      >
        {super.renderComponent()}
      </SentryDocumentTitle>
    );
  }
}

export default EventDetailsContent;
