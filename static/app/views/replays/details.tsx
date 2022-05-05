import React from 'react';
import styled from '@emotion/styled';

import DetailedError from 'sentry/components/errors/detailedError';
import NotFound from 'sentry/components/errors/notFound';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Panel, PanelBody, PanelHeader as _PanelHeader} from 'sentry/components/panels';
import ReplayBreadcrumbOverview from 'sentry/components/replays/breadcrumbs/replayBreadcrumbOverview';
import Scrobber from 'sentry/components/replays/player/scrobber';
import {Provider as ReplayContextProvider} from 'sentry/components/replays/replayContext';
import ReplayController from 'sentry/components/replays/replayController';
import ReplayPlayer from 'sentry/components/replays/replayPlayer';
import useFullscreen from 'sentry/components/replays/useFullscreen';
import {t} from 'sentry/locale';
import {PageContent} from 'sentry/styles/organization';
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
    replay,
  } = useReplayEvent({
    eventSlug,
    location,
    orgId,
  });

  const {ref: fullscreenRef, isFullscreen, toggle: toggleFullscreen} = useFullscreen();

  if (fetching) {
    return (
      <DetailLayout orgId={orgId}>
        <LoadingIndicator />
      </DetailLayout>
    );
  }
  if (!replay) {
    // TODO(replay): Give the user more details when errors happen
    console.log({fetching, fetchError}); // eslint-disable-line no-console
    return (
      <DetailLayout orgId={orgId}>
        <PageContent>
          <NotFound />
        </PageContent>
      </DetailLayout>
    );
  }
  if (replay.getRRWebEvents().length < 2) {
    return (
      <DetailLayout event={replay.getEvent()} orgId={orgId}>
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
    <ReplayContextProvider
      events={replay.getRRWebEvents()}
      initialTimeOffset={initialTimeOffset}
    >
      <DetailLayout
        event={event}
        orgId={orgId}
        crumbs={breadcrumbEntry?.data.values || []}
      >
        <Layout.Body>
          <ReplayLayout ref={fullscreenRef}>
            <Panel>
              <PanelHeader disablePadding>
                <ManualResize isFullscreen={isFullscreen}>
                  <ReplayPlayer />
                </ManualResize>
              </PanelHeader>
              <Scrobber />
              <PanelBody withPadding>
                <ReplayController toggleFullscreen={toggleFullscreen} />
              </PanelBody>
            </Panel>
          </ReplayLayout>
          <Layout.Side>
            <UserActionsNavigator event={event} entry={breadcrumbEntry} />
          </Layout.Side>
          <Layout.Main fullWidth>
            <Panel>
              <BreadcrumbTimeline crumbs={breadcrumbEntry?.data.values || []} />
            </Panel>
            <FocusArea
              event={replay.getEvent()}
              eventWithSpans={mergedReplayEvent}
              memorySpans={memorySpans}
            />
          </Layout.Main>
        </Layout.Body>
      </DetailLayout>
    </ReplayContextProvider>
  );
}

const PanelHeader = styled(_PanelHeader)`
  display: block;
  padding: 0;
`;

const ManualResize = styled('div')<{isFullscreen: boolean}>`
  resize: vertical;
  overflow: auto;
  max-width: 100%;

  ${p =>
    p.isFullscreen
      ? `resize: none;
      width: auto !important;
      height: auto !important;
      `
      : ''}
`;

const ReplayLayout = styled(Layout.Main)`
  :fullscreen {
    display: grid;
    grid-template-rows: auto max-content;
    background: ${p => p.theme.gray500};
  }
`;

const BreadcrumbTimeline = styled(ReplayBreadcrumbOverview)`
  max-height: 5em;
`;

export default ReplayDetails;
