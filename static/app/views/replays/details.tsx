import React from 'react';
import styled from '@emotion/styled';

import DetailedError from 'sentry/components/errors/detailedError';
import NotFound from 'sentry/components/errors/notFound';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Panel, PanelBody, PanelHeader as _PanelHeader} from 'sentry/components/panels';
import ReplayTimeline from 'sentry/components/replays/breadcrumbs/replayTimeline';
import HorizontalMouseTracking from 'sentry/components/replays/player/horizontalMouseTracking';
import {PlayerScrubber} from 'sentry/components/replays/player/scrubber';
import {Provider as ReplayContextProvider} from 'sentry/components/replays/replayContext';
import ReplayController from 'sentry/components/replays/replayController';
import ReplayCurrentUrl from 'sentry/components/replays/replayCurrentUrl';
import ReplayPlayer from 'sentry/components/replays/replayPlayer';
import useFullscreen from 'sentry/components/replays/useFullscreen';
import {t} from 'sentry/locale';
import {PageContent} from 'sentry/styles/organization';
import useReplayData from 'sentry/utils/replays/useReplayData';
import {useRouteContext} from 'sentry/utils/useRouteContext';

import DetailLayout from './detail/detailLayout';
import FocusArea from './detail/focusArea';
import UserActionsNavigator from './detail/userActionsNavigator';

function ReplayDetails() {
  const {
    location,
    params: {eventSlug, orgId},
  } = useRouteContext();

  const {
    t: initialTimeOffset, // Time, in seconds, where the video should start
  } = location.query;

  const {fetchError, fetching, onRetry, replay} = useReplayData({
    eventSlug,
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
    <ReplayContextProvider replay={replay} initialTimeOffset={initialTimeOffset}>
      <DetailLayout
        event={replay.getEvent()}
        orgId={orgId}
        crumbs={replay.getRawCrumbs()}
      >
        <Layout.Body>
          <ReplayLayout ref={fullscreenRef}>
            <PanelNoMargin>
              <PanelHeader>
                <ReplayCurrentUrl />
              </PanelHeader>
              <PanelHeader disablePadding noBorder>
                <ManualResize isFullscreen={isFullscreen}>
                  <ReplayPlayer />
                </ManualResize>
              </PanelHeader>
              <HorizontalMouseTracking>
                <PlayerScrubber />
              </HorizontalMouseTracking>
              <PanelBody withPadding>
                <ReplayController toggleFullscreen={toggleFullscreen} />
              </PanelBody>
            </PanelNoMargin>
          </ReplayLayout>
          <Layout.Side>
            <UserActionsNavigator
              crumbs={replay.getRawCrumbs()}
              event={replay.getEvent()}
            />
          </Layout.Side>
          <Layout.Main fullWidth>
            <Panel>
              <ReplayTimeline />
            </Panel>
            <FocusArea replay={replay} />
          </Layout.Main>
        </Layout.Body>
      </DetailLayout>
    </ReplayContextProvider>
  );
}

const PanelNoMargin = styled(Panel)`
  margin-bottom: 0;
`;

const PanelHeader = styled(_PanelHeader)<{noBorder?: boolean}>`
  display: block;
  padding: 0;
  ${p => (p.noBorder ? 'border-bottom: none;' : '')}
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

export default ReplayDetails;
