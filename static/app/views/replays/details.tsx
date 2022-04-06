import React from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import Breadcrumbs from 'sentry/components/breadcrumbs';
import NotFound from 'sentry/components/errors/notFound';
import EventOrGroupTitle from 'sentry/components/eventOrGroupTitle';
import EventEntry from 'sentry/components/events/eventEntry';
import EventMessage from 'sentry/components/events/eventMessage';
import BaseRRWebReplayer from 'sentry/components/events/rrwebReplayer/baseRRWebReplayer';
import FeatureBadge from 'sentry/components/featureBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import TagsTable from 'sentry/components/tagsTable';
import {t} from 'sentry/locale';
import {PageContent} from 'sentry/styles/organization';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {getMessage} from 'sentry/utils/events';
import withOrganization from 'sentry/utils/withOrganization';
import AsyncView from 'sentry/views/asyncView';

import useReplayEvent from './utils/useReplayEvent';

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
        <EventOrGroupTitle data={event} /> <FeatureBadge type="alpha" />
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

  getTitle() {
    if (this.state.event) {
      return `${this.state.event.id} - Replays - ${this.props.params.orgId}`;
    }
    return `Replays - ${this.props.params.orgId}`;
  }

  renderLoading() {
    return <PageContent>{super.renderLoading()}</PageContent>;
  }

  renderBody() {
    const {
      location,
      router,
      route,
      organization,
      params: {eventSlug, orgId},
    } = this.props;
    return (
      <ReplayLoader
        eventSlug={eventSlug}
        location={location}
        orgId={orgId}
        organization={organization}
        router={router}
        route={route}
      />
    );
  }
}

function getProjectSlug(event: Event) {
  return event.projectSlug || event['project.name']; // seems janky
}

function ReplayLoader(props: ReplayLoaderProps) {
  const orgSlug = props.orgId;

  const {
    fetchError,
    fetching,
    breadcrumbEvent,
    event,
    replayEvents,
    rrwebEvents,
    mergedReplayEvent,
  } = useReplayEvent(props);

  /* eslint-disable-next-line no-console */
  console.log({
    fetchError,
    fetching,
    event,
    replayEvents,
    rrwebEvents,
    mergedReplayEvent,
  });

  const renderMain = () => {
    if (fetching) {
      return <LoadingIndicator />;
    }
    if (!event) {
      return <NotFound />;
    }

    return (
      <React.Fragment>
        <BaseRRWebReplayer events={rrwebEvents} />

        {breadcrumbEvent && (
          <EventEntry
            projectSlug={getProjectSlug(event)}
            // group={group}
            organization={props.organization}
            event={event}
            entry={breadcrumbEvent}
            route={props.route}
            router={props.router}
          />
        )}

        {mergedReplayEvent && (
          <EventEntry
            key={`${mergedReplayEvent.id}`}
            projectSlug={getProjectSlug(mergedReplayEvent)}
            // group={group}
            organization={props.organization}
            event={mergedReplayEvent}
            entry={mergedReplayEvent.entries[0]}
            route={props.route}
            router={props.router}
          />
        )}
      </React.Fragment>
    );
  };

  const renderSide = () => {
    if (event) {
      return <TagsTable generateUrl={() => ''} event={event} query="" />;
    }
    return null;
  };

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
          {event ? <EventHeader event={event} /> : null}
        </Layout.HeaderContent>
      </Layout.Header>
      <Layout.Body>
        <Layout.Main>{renderMain()}</Layout.Main>
        <Layout.Side>{renderSide()}</Layout.Side>
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
