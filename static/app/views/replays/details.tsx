import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import Breadcrumbs from 'sentry/components/breadcrumbs';
import NotFound from 'sentry/components/errors/notFound';
import EventOrGroupTitle from 'sentry/components/eventOrGroupTitle';
import EventMessage from 'sentry/components/events/eventMessage';
import RRWebIntegration from 'sentry/components/events/rrwebIntegration';
import * as Layout from 'sentry/components/layouts/thirds';
import TagsTable from 'sentry/components/tagsTable';
import {t} from 'sentry/locale';
import {PageContent} from 'sentry/styles/organization';
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

    const replayView = EventView.fromLocation(location);
    const replayQuery = replayView.getEventsAPIPayload(location);

    const replayEventsView = EventView.fromSavedQuery({
      id: '',
      name: '',
      version: 2,
      fields: ['timestamp', 'rootReplayId'],
      orderby: 'timestamp',
      projects: [],
      range: '14d',
      query: `transaction:sentry-replay-event`,
    });
    replayEventsView.additionalConditions.addFilterValues('rootReplayId', [
      params.eventSlug,
    ]);
    const replayEventsQuery = replayEventsView.getEventsAPIPayload(location);

    return [
      [
        'replay',
        `/organizations/${params.orgId}/eventsv2/${params.eventSlug}`,
        {query: replayQuery},
      ],
      [
        'replayEvents',
        `/organizations/${params.orgId}/eventsv2/`,
        {query: replayEventsQuery},
      ],
    ];
  }

  getTitle() {
    if (this.state.replay) {
      return `${this.state.replay.id} - Replays - ${this.props.params.orgId}`;
    }
    return `Replays - ${this.props.params.orgId}`;
  }

  getEventView = (): EventView => {
    const {location} = this.props;

    return EventView.fromLocation(location);
  };

  renderLoading() {
    return <PageContent>{super.renderLoading()}</PageContent>;
  }

  generateTagUrl = () => {
    return ''; // todo
  };

  getProjectSlug(event: Event) {
    return event.projectSlug || event['project.name']; // seems janky
  }

  renderBody() {
    const {replay, replayEvents} = this.state;
    const orgSlug = this.props.params.orgId;
    if (!replayEvents) {
      return <NotFound />;
    }

    const eventView = this.getEventView();

    return (
      <NoPaddingContent>
        <Layout.Header>
          <Layout.HeaderContent>
            <Breadcrumbs
              crumbs={[
                {
                  to: `/organizations/${orgSlug}/replays/`,
                  label: t('Replays'),
                },
                {label: t('Replay Details')}, // TODO: put replay ID or something here
              ]}
            />
            <TitleWrapper>Replay: {this.props.params.eventSlug}</TitleWrapper>
          </Layout.HeaderContent>
        </Layout.Header>

        <Layout.Body>
          <Layout.Main>
            <RRWebIntegration
              key={replay.id}
              event={replay}
              orgId={orgSlug}
              projectId={this.getProjectSlug(replay)}
            />
            {replayEvents.map(event => (
              <EventHeader key={event.id} event={event} />
            ))}
          </Layout.Main>
          <Layout.Side>
            <TagsTable
              generateUrl={this.generateTagUrl}
              event={replay}
              query={eventView.query}
            />
          </Layout.Side>
        </Layout.Body>
      </NoPaddingContent>
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

const NoPaddingContent = styled(PageContent)`
  padding: 0;
`;

export default ReplayDetails;
