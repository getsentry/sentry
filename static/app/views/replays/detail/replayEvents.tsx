import {RouteComponentProps, withRouter} from 'react-router';
import styled from '@emotion/styled';
import first from 'lodash/first';

import AsyncComponent from 'sentry/components/asyncComponent';
import EventOrGroupTitle from 'sentry/components/eventOrGroupTitle';
import EventMessage from 'sentry/components/events/eventMessage';
import RRWebIntegration from 'sentry/components/events/rrwebIntegration';
import * as Layout from 'sentry/components/layouts/thirds';
import TagsTable from 'sentry/components/tagsTable';
import space from 'sentry/styles/space';
import {Event} from 'sentry/types/event';
import EventView from 'sentry/utils/discover/eventView';
import {getMessage} from 'sentry/utils/events';

import {Replay} from '../types';

type Props = AsyncComponent['props'] &
  RouteComponentProps<{orgId: string; replayId: string}, {}> & {
    eventSlugs: string[];
  };

type State = AsyncComponent['state'] & {
  replayList: Replay[] | null;
};

const EventHeader = ({event}: {event: Event}) => {
  const message = getMessage(event);
  return (
    <EventHeaderContainer data-test-id="event-header">
      <TitleWrapper>
        <EventOrGroupTitle data={event} /> {event.id}
      </TitleWrapper>
      {message && (
        <MessageWrapper>
          <EventMessage message={message} />
        </MessageWrapper>
      )}
    </EventHeaderContainer>
  );
};

class ReplayEvents extends AsyncComponent<Props, State> {
  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {eventSlugs, params, location} = this.props;

    return eventSlugs.map(eventSlug => {
      const eventView = EventView.fromLocation(location);
      const query = eventView.getEventsAPIPayload(location);

      return [eventSlug, `/organizations/${params.orgId}/events/${eventSlug}/`, {query}];
    });
  }

  renderLoading() {
    return super.renderLoading(); // todo
  }

  generateTagUrl = () => {
    return ''; // todo
  };

  getEventView = (): EventView => {
    const {location} = this.props;

    return EventView.fromLocation(location);
  };

  getProjectSlug(event: Event) {
    return event.projectSlug || event['project.name']; // seems janky
  }

  renderBody() {
    const {params, eventSlugs} = this.props;
    const orgSlug = params.orgId;

    const events = eventSlugs.map(eventSlug => this.state[eventSlug]);
    const eventView = this.getEventView();

    const firstEvent = first(events);

    return (
      <Layout.Body>
        <Layout.Main>
          {events.map(event => (
            <EventHeader key={event.id} event={event} />
          ))}
          {events.map(event => (
            <RRWebIntegration
              key={event.id}
              event={event}
              orgId={orgSlug}
              projectId={this.getProjectSlug(event)}
            />
          ))}
        </Layout.Main>
        <Layout.Side>
          <TagsTable
            generateUrl={this.generateTagUrl}
            event={firstEvent}
            query={eventView.query}
          />
        </Layout.Side>
      </Layout.Body>
    );
  }
}

const EventHeaderContainer = styled('div')`
  max-width: ${p => p.theme.breakpoints[0]};
`;

const TitleWrapper = styled('div')`
  font-size: ${p => p.theme.headerFontSize};
  margin-top: 20px;
`;

const MessageWrapper = styled('div')`
  margin-top: ${space(1)};
`;

export default withRouter(ReplayEvents);
