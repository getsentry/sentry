import React from 'react';
import styled from '@emotion/styled';

import DetailedError from 'sentry/components/errors/detailedError';
import NotFound from 'sentry/components/errors/notFound';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import ReplayBreadcrumbOverview from 'sentry/components/replays/breadcrumbs/replayBreadcrumbOverview';
import {Provider as ReplayContextProvider} from 'sentry/components/replays/replayContext';
import ReplayController from 'sentry/components/replays/replayController';
import ReplayPlayer from 'sentry/components/replays/replayPlayer';
import useFullscreen from 'sentry/components/replays/useFullscreen';
import {t} from 'sentry/locale';
import {PageContent} from 'sentry/styles/organization';
import space from 'sentry/styles/space';
import {useRouteContext} from 'sentry/utils/useRouteContext';

import DetailLayout from './detail/detailLayout';
import FocusArea from './detail/focusArea';
import UserActionsNavigator from './detail/userActionsNavigator';
import useReplayEvent from './utils/useReplayEvent';

function ReplayDetails() {
  const {
    location,
    params: {eventSlug, orgId},
  } = useRouteContext();

  const {
    t: initialTimeOffset, // Time, in seconds, where the video should start
  } = location.query;

  const {
    breadcrumbEntry,
    event,
    mergedReplayEvent,
    memorySpans,
    fetchError,
    fetching,
    onRetry,
    rrwebEvents,
  } = useReplayEvent({
    eventSlug,
    location,
    orgId,
  });

  const {ref: fullscreenRef, isFullscreen, toggle: toggleFullscreen} = useFullscreen();

  if (fetching) {
    return (
      <DetailLayout event={event} orgId={orgId}>
        <LoadingIndicator />
      </DetailLayout>
    );
  }
  if (!event) {
    // TODO(replay): Give the user more details when errors happen
    console.log({fetching, fetchError}); // eslint-disable-line no-console
    return (
      <DetailLayout event={event} orgId={orgId}>
        <PageContent>
          <NotFound />
        </PageContent>
      </DetailLayout>
    );
  }
  if (!rrwebEvents || rrwebEvents.length < 2) {
    return (
      <DetailLayout event={event} orgId={orgId}>
        <DetailedError
          onRetry={onRetry}
          hideSupportLinks
          heading={t('Expected two or more replay events')}
          message={
            <React.Fragment>
              <p>{t('This Replay may not have captured any user actions.')}</p>
              <p>
                {t(
                  'Or there may be an issue loading the actions from the server, click to try loading the Replay again.'
                )}
              </p>
            </React.Fragment>
          }
        />
      </DetailLayout>
    );
  }

  return (
    <ReplayContextProvider events={rrwebEvents} initialTimeOffset={initialTimeOffset}>
      <DetailLayout
        event={event}
        orgId={orgId}
        crumbs={breadcrumbEntry?.data.values || []}
      >
        <Layout.Body>
          <ReplayLayout ref={fullscreenRef}>
            {/* In fullscreen we need to consider the max-height that the player is able
            to full up, on a page that scrolls we only consider the max-width. */}
            <ReplayPlayer fixedHeight={isFullscreen} />
            <ReplayController toggleFullscreen={toggleFullscreen} />
          </ReplayLayout>
          <Layout.Side>
            <UserActionsNavigator event={event} entry={breadcrumbEntry} />
          </Layout.Side>
          <Layout.Main fullWidth>
            <BreadcrumbTimeline crumbs={breadcrumbEntry?.data.values || []} />
            <FocusArea
              event={event}
              eventWithSpans={mergedReplayEvent}
              memorySpans={memorySpans}
            />
          </Layout.Main>
        </Layout.Body>
      </DetailLayout>
    </ReplayContextProvider>
  );
}

const ReplayLayout = styled(Layout.Main)`
  :fullscreen {
    display: grid;
    grid-template-rows: auto max-content;
    background: ${p => p.theme.gray500};
  }
`;

const BreadcrumbTimeline = styled(ReplayBreadcrumbOverview)`
  max-height: 5em;
  margin-bottom: ${space(2)};
`;

export default ReplayDetails;
