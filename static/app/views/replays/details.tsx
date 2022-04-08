import React from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import Breadcrumbs from 'sentry/components/breadcrumbs';
import NotFound from 'sentry/components/errors/notFound';
import EventEntry from 'sentry/components/events/eventEntry';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import ReplayBreadcrumbs from 'sentry/components/replays/replayBreadcrumbs';
import {Provider as ReplayContextProvider} from 'sentry/components/replays/replayContext';
import ReplayController from 'sentry/components/replays/replayController';
import ReplayHeader from 'sentry/components/replays/replayHeader';
import ReplayPlayer from 'sentry/components/replays/replayPlayer';
import TagsTable from 'sentry/components/tagsTable';
import {t} from 'sentry/locale';
import {PageContent} from 'sentry/styles/organization';
import {Organization} from 'sentry/types';
import {Event} from 'sentry/types/event';
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
    breadcrumbEntry,
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
        <ReplayContextProvider events={rrwebEvents || []}>
          <ReplayPlayer />
          <ReplayController />
        </ReplayContextProvider>

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
      return (
        <React.Fragment>
          <ReplayBreadcrumbs
            entry={breadcrumbEntry}
            event={event}
            organization={props.organization}
            route={props.route}
            router={props.router}
          />
          <TagsTable generateUrl={() => ''} event={event} query="" />
        </React.Fragment>
      );
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
          {event ? <ReplayHeader event={event} /> : null}
        </Layout.HeaderContent>
      </Layout.Header>
      <Layout.Body>
        <Layout.Main>{renderMain()}</Layout.Main>
        <Layout.Side>{renderSide()}</Layout.Side>
      </Layout.Body>
    </NoPaddingContent>
  );
}

const NoPaddingContent = styled(PageContent)`
  padding: 0;
`;

export default withOrganization(ReplayDetails);
