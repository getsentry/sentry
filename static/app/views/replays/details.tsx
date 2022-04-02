import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import Breadcrumbs from 'sentry/components/breadcrumbs';
import NotFound from 'sentry/components/errors/notFound';
import EventOrGroupTitle from 'sentry/components/eventOrGroupTitle';
import EventMessage from 'sentry/components/events/eventMessage';
import BaseRRWebReplayer from 'sentry/components/events/rrwebReplayer/baseRRWebReplayer';
import * as Layout from 'sentry/components/layouts/thirds';
import TagsTable from 'sentry/components/tagsTable';
import {t} from 'sentry/locale';
import {PageContent} from 'sentry/styles/organization';
import space from 'sentry/styles/space';
import {Event} from 'sentry/types/event';
import {getMessage} from 'sentry/utils/events';
import useReplayEvent from 'sentry/utils/useReplayEvent';
import AsyncView from 'sentry/views/asyncView';

type Props = AsyncView['props'] &
  RouteComponentProps<{eventSlug: string; orgId: string}, {}>;

type ReplayLoaderProps = {eventSlug: string; location: Props['location']; orgId: string};

type State = AsyncView['state'];

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
    loading: true,
    reloading: false,
    error: false,
    errors: {},
  };

  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    return [];
  }

  getTitle() {
    if (this.state.event) {
      return `${this.state.event.id} - Replays - ${this.props.params.orgId}`;
    }
    return `Replays - ${this.props.params.orgId}`;
  }

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
    return (
      <ReplayLoader
        eventSlug={this.props.params.eventSlug}
        location={this.props.location}
        orgId={this.props.params.orgId}
      />
    );
    // const {event, replayEvents} = this.state;

    // const eventView = this.getEventView();
  }
}

function ReplayLoader(props: ReplayLoaderProps) {
  const orgSlug = props.orgId;

  const {fetchError, fetching, event, replayEvents, rrwebEvents} = useReplayEvent(props);

  /* eslint-disable-next-line no-console */
  console.log({fetchError, fetching, event, replayEvents, rrwebEvents});

  if (!event) {
    return <NotFound />;
  }

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
          <EventHeader event={event} />
        </Layout.HeaderContent>
      </Layout.Header>

      <Layout.Body>
        <Layout.Main>
          <BaseRRWebReplayer events={rrwebEvents} />
          {replayEvents.map(replayEvent => (
            <TitleWrapper key={replayEvent.id}>
              ReplayEvent: {replayEvent.id}
            </TitleWrapper>
          ))}
        </Layout.Main>
        <Layout.Side>
          <TagsTable generateUrl={() => ''} event={event} query="" />
        </Layout.Side>
      </Layout.Body>
    </NoPaddingContent>
  );
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
