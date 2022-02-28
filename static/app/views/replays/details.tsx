import {Fragment} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import NotFound from 'sentry/components/errors/notFound';
import EventOrGroupTitle from 'sentry/components/eventOrGroupTitle';
import EventMessage from 'sentry/components/events/eventMessage';
import * as Layout from 'sentry/components/layouts/thirds';
import {Panel} from 'sentry/components/panels';
import TagsTable from 'sentry/components/tagsTable';
import space from 'sentry/styles/space';
import {Event} from 'sentry/types/event';
import EventView from 'sentry/utils/discover/eventView';
import {getMessage} from 'sentry/utils/events';
import AsyncView from 'sentry/views/asyncView';

type Props = AsyncView['props'] &
  RouteComponentProps<{eventSlug: string; orgId: string}, {}>;

type State = AsyncView['state'] & {
  event: Event | undefined;
  eventView: EventView;
};

const EventHeader = ({event}: {event: Event}) => {
  const message = getMessage(event);
  return (
    <EventHeaderContainer data-test-id="event-header">
      <TitleWrapper>
        <EventOrGroupTitle data={event} />
      </TitleWrapper>
      {message && (
        <MessageWrapper>
          <EventMessage message={message} />
        </MessageWrapper>
      )}
    </EventHeaderContainer>
  );
};

class ReplayDetails extends AsyncView<Props, State> {
  state: State = {
    eventView: EventView.fromLocation(this.props.location),
    loading: true,
    reloading: false,
    error: false,
    errors: {},
    event: undefined,
  };

  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const {params, location} = this.props;

    const eventView = EventView.fromLocation(location);
    const query = eventView.getEventsAPIPayload(location);

    return [
      ['event', `/organizations/${params.orgId}/events/${params.eventSlug}/`, {query}],
    ];
  }

  getTitle() {
    if (this.state.event) {
      return `${this.state.event.id} - Replays - ${this.props.params.orgId}`;
    }
    return `Replays - ${this.props.params.orgId}`;
  }

  onUpdate = (data: Event) =>
    this.setState(state => ({event: {...state.event, ...data}}));

  generateTagUrl = () => {
    return ''; // todo
  };

  getEventView = (): EventView => {
    const {location} = this.props;

    return EventView.fromLocation(location);
  };

  renderBody() {
    const {event} = this.state;

    if (!event) {
      return <NotFound />;
    }

    const eventView = this.getEventView();

    return (
      <Fragment>
        <Fragment>
          <Layout.Header>
            <Layout.HeaderContent>
              <EventHeader event={event} />
            </Layout.HeaderContent>
          </Layout.Header>
        </Fragment>

        <Layout.Body>
          <Layout.Main>
            <Panel style={{paddingBottom: 0}}>lol</Panel>
          </Layout.Main>
          <Layout.Side>
            <TagsTable
              generateUrl={this.generateTagUrl}
              event={event}
              query={eventView.query}
            />
          </Layout.Side>
        </Layout.Body>
      </Fragment>
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

export default ReplayDetails;
