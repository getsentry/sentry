import React from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import Breadcrumbs from 'sentry/components/breadcrumbs';
import NotFound from 'sentry/components/errors/notFound';
import EventOrGroupTitle from 'sentry/components/eventOrGroupTitle';
import EventEntries from 'sentry/components/events/eventEntries';
import EventMessage from 'sentry/components/events/eventMessage';
import BaseRRWebReplayer from 'sentry/components/events/rrwebReplayer/baseRRWebReplayer';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import TagsTable from 'sentry/components/tagsTable';
import {t} from 'sentry/locale';
import {PageContent} from 'sentry/styles/organization';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {getMessage} from 'sentry/utils/events';
import useReplayEvent from 'sentry/utils/useReplayEvent';
import withOrganization from 'sentry/utils/withOrganization';
import AsyncView from 'sentry/views/asyncView';

type Props = AsyncView['props'] &
  RouteComponentProps<
    {
      eventSlug: string;
      orgId: string;
    },
    {}
  > & {organization: Organization};

type ReplayLoaderProps = {
  eventSlug: string;
  location: Props['location'];
  orgId: string;
  organization: Organization;
  route: Props['route'];
  router: Props['router'];
};

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

  renderBody() {
    return (
      <ReplayLoader
        eventSlug={this.props.params.eventSlug}
        location={this.props.location}
        orgId={this.props.params.orgId}
        organization={this.props.organization}
        router={this.props.router}
        route={this.props.route}
      />
    );
  }
}

function getProjectSlug(event: Event) {
  return event.projectSlug || event['project.name']; // seems janky
}

function ReplayLoader(props: ReplayLoaderProps) {
  const orgSlug = props.orgId;

  const {fetchError, fetching, event, replayEvents, rrwebEvents} = useReplayEvent(props);

  /* eslint-disable-next-line no-console */
  console.log({fetchError, fetching, event, replayEvents, rrwebEvents});

  if (fetching) {
    return <LoadingIndicator />;
  }

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
          {replayEvents?.map(replayEvent => (
            <React.Fragment key={replayEvent.id}>
              <TitleWrapper>ReplayEvent: {replayEvent.id}</TitleWrapper>
              <EventEntries
                // group={group}
                event={replayEvent}
                organization={props.organization}
                project={{slug: getProjectSlug(replayEvent)}}
                location={location}
                showExampleCommit={false}
                router={props.router}
                route={props.route}
              />
            </React.Fragment>
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

export default withOrganization(ReplayDetails);
