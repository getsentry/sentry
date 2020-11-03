import React from 'react';
import {Params} from 'react-router/lib/Router';
import {Location} from 'history';
import styled from '@emotion/styled';
import PropTypes from 'prop-types';

import {BorderlessEventEntries} from 'app/components/events/eventEntries';
import * as SpanEntryContext from 'app/components/events/interfaces/spans/context';
import {EventQuery} from 'app/actionCreators/events';
import space from 'app/styles/space';
import {t} from 'app/locale';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import {Client} from 'app/api';
import withApi from 'app/utils/withApi';
import {getMessage, getTitle} from 'app/utils/events';
import {Organization, Event, EventTag} from 'app/types';
import SentryTypes from 'app/sentryTypes';
import Button from 'app/components/button';
import Feature from 'app/components/acl/feature';
import RootSpanStatus from 'app/components/events/rootSpanStatus';
import OpsBreakdown from 'app/components/events/opsBreakdown';
import EventMetadata from 'app/components/events/eventMetadata';
import LoadingError from 'app/components/loadingError';
import NotFound from 'app/components/errors/notFound';
import TagsTable from 'app/components/tagsTable';
import AsyncComponent from 'app/components/asyncComponent';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import Projects from 'app/utils/projects';
import EventView from 'app/utils/discover/eventView';
import {transactionSummaryRouteWithQuery} from 'app/views/performance/transactionSummary/utils';
import {eventDetailsRoute} from 'app/utils/discover/urls';
import * as Layout from 'app/components/layouts/thirds';
import ButtonBar from 'app/components/buttonBar';
import {FIELD_TAGS} from 'app/utils/discover/fields';

import {generateTitle, getExpandedResults} from '../utils';
import LinkedIssue from './linkedIssue';
import DiscoverBreadcrumb from '../breadcrumb';

const slugValidator = function (
  props: {[key: string]: any},
  propName: string,
  componentName: string
) {
  const value = props[propName];
  // Accept slugs that look like:
  // * project-slug:deadbeef
  if (value && typeof value === 'string' && !/^(?:[^:]+):(?:[a-f0-9-]+)$/.test(value)) {
    return new Error(`Invalid value for ${propName} provided to ${componentName}.`);
  }
  return null;
};

type Props = {
  organization: Organization;
  location: Location;
  params: Params;
  api: Client;
  eventSlug: string;
  eventView: EventView;
};

type State = {
  event: Event | undefined;
  isSidebarVisible: boolean;
} & AsyncComponent['state'];

class EventDetailsContent extends AsyncComponent<Props, State> {
  static propTypes: any = {
    organization: SentryTypes.Organization.isRequired,
    eventSlug: slugValidator,
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

  getEndpoints(): Array<[string, string, {query: EventQuery}]> {
    const {organization, params, location, eventView} = this.props;
    const {eventSlug} = params;

    const query = eventView.getEventsAPIPayload(location);

    // Fields aren't used, reduce complexity by omitting from query entirely
    query.field = [];

    const url = `/organizations/${organization.slug}/events/${eventSlug}/`;

    // Get a specific event. This could be coming from
    // a paginated group or standalone event.
    return [['event', url, {query}]];
  }

  get projectId() {
    return this.props.eventSlug.split(':')[0];
  }

  generateTagKey = (tag: EventTag) => {
    // Some tags may be normalized from context, but not all of them are.
    // This supports a user making a custom tag with the same name as one
    // that comes from context as all of these are also tags.
    if (tag.key in FIELD_TAGS) {
      return `tags[${tag.key}]`;
    }
    return tag.key;
  };

  generateTagUrl = (tag: EventTag) => {
    const {eventView, organization} = this.props;
    const {event} = this.state;
    if (!event) {
      return '';
    }
    const eventReference = {...event};
    if (eventReference.id) {
      delete eventReference.id;
    }
    const tagKey = this.generateTagKey(tag);
    const nextView = getExpandedResults(eventView, {[tagKey]: tag.value}, eventReference);
    return nextView.getResultsViewUrlTarget(organization.slug);
  };

  renderBody() {
    const {event} = this.state;

    if (!event) {
      return <NotFound />;
    }

    return this.renderContent(event);
  }

  renderContent(event: Event) {
    const {api, organization, location, eventView} = this.props;
    const {isSidebarVisible} = this.state;

    // metrics
    trackAnalyticsEvent({
      eventKey: 'discover_v2.event_details',
      eventName: 'Discoverv2: Opened Event Details',
      event_type: event.type,
      organization_id: parseInt(organization.id, 10),
    });

    const transactionName = event.tags.find(tag => tag.key === 'transaction')?.value;
    const transactionSummaryTarget =
      event.type === 'transaction' && transactionName
        ? transactionSummaryRouteWithQuery({
            orgSlug: organization.slug,
            transaction: transactionName,
            projectID: event.projectID,
            query: location.query,
          })
        : null;

    return (
      <React.Fragment>
        <Layout.Header>
          <Layout.HeaderContent>
            <DiscoverBreadcrumb
              eventView={eventView}
              event={event}
              organization={organization}
              location={location}
            />
            <EventHeader event={event} />
          </Layout.HeaderContent>
          <StyledHeaderActions>
            <ButtonBar gap={1}>
              <Button onClick={this.toggleSidebar}>
                {isSidebarVisible ? 'Hide Details' : 'Show Details'}
              </Button>
              {transactionSummaryTarget && (
                <Feature organization={organization} features={['performance-view']}>
                  {({hasFeature}) => (
                    <Button
                      disabled={!hasFeature}
                      priority="primary"
                      to={transactionSummaryTarget}
                    >
                      {t('Go to Summary')}
                    </Button>
                  )}
                </Feature>
              )}
            </ButtonBar>
          </StyledHeaderActions>
        </Layout.Header>
        <Layout.Body>
          <Layout.Main fullWidth={!isSidebarVisible}>
            <Projects orgId={organization.slug} slugs={[this.projectId]}>
              {({projects}) => (
                <SpanEntryContext.Provider
                  value={{
                    getViewChildTransactionTarget: childTransactionProps => {
                      const childTransactionLink = eventDetailsRoute({
                        eventSlug: childTransactionProps.eventSlug,
                        orgSlug: organization.slug,
                      });

                      return {
                        pathname: childTransactionLink,
                        query: eventView.generateQueryStringObject(),
                      };
                    },
                  }}
                >
                  <BorderlessEventEntries
                    api={api}
                    organization={organization}
                    event={event}
                    project={projects[0]}
                    location={location}
                    showExampleCommit={false}
                    showTagSummary={false}
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
              {event.groupID && (
                <LinkedIssue groupId={event.groupID} eventId={event.eventID} />
              )}
              <TagsTable
                generateUrl={this.generateTagUrl}
                event={event}
                query={eventView.query}
              />
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
    const {eventView, organization} = this.props;
    const {event} = this.state;

    const title = generateTitle({eventView, event});

    return (
      <SentryDocumentTitle title={title} objSlug={organization.slug}>
        {super.renderComponent()}
      </SentryDocumentTitle>
    );
  }
}

const EventHeader = (props: {event: Event}) => {
  const {title} = getTitle(props.event);

  const message = getMessage(props.event);

  return (
    <Layout.Title data-test-id="event-header">
      <span>
        {title}
        {message && message.length > 0 ? ':' : null}
      </span>
      <EventSubheading>{getMessage(props.event)}</EventSubheading>
    </Layout.Title>
  );
};

const StyledHeaderActions = styled(Layout.HeaderActions)`
  @media (max-width: ${p => p.theme.breakpoints[1]}) {
    display: none;
  }
`;

const EventSubheading = styled('span')`
  color: ${p => p.theme.gray300};
  margin-left: ${space(1)};
`;

export default withApi(EventDetailsContent);
