import React, {useState} from 'react';
import styled from '@emotion/styled';

import ErrorBoundary from 'sentry/components/errorBoundary';
import DetailedError from 'sentry/components/errors/detailedError';
import NotFound from 'sentry/components/errors/notFound';
import {HeaderContainer} from 'sentry/components/events/interfaces/spans/header';
import * as Layout from 'sentry/components/layouts/thirds';
import ReplayTimeline from 'sentry/components/replays/breadcrumbs/replayTimeline';
import {Provider as ReplayContextProvider} from 'sentry/components/replays/replayContext';
import ReplayView from 'sentry/components/replays/replayView';
import {t} from 'sentry/locale';
import {PageContent} from 'sentry/styles/organization';
import space from 'sentry/styles/space';
import useFullscreen from 'sentry/utils/replays/hooks/useFullscreen';
import useReplayData from 'sentry/utils/replays/hooks/useReplayData';
import {useRouteContext} from 'sentry/utils/useRouteContext';

import DetailLayout from './detail/detailLayout';
import FocusArea from './detail/focusArea';
import FocusTabs from './detail/focusTabs';
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

  const [isPictureInPicture, setIsPictureInPicture] = useState(false);
  const togglePictureInPicture = () => setIsPictureInPicture(!isPictureInPicture);

  if (!fetching && !replay) {
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

  if (!fetching && replay && replay.getRRWebEvents().length < 2) {
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
        event={replay?.getEvent()}
        orgId={orgId}
        crumbs={replay?.getRawCrumbs()}
      >
        <Layout.Body>
          <Layout.Main ref={fullscreenRef}>
            <ReplayView
              toggleFullscreen={toggleFullscreen}
              isFullscreen={isFullscreen}
              isPictureInPicture={isPictureInPicture}
              togglePictureInPicture={togglePictureInPicture}
            />
          </Layout.Main>

          <Layout.Side>
            <ErrorBoundary>
              <UserActionsNavigator
                crumbs={replay?.getRawCrumbs()}
                event={replay?.getEvent()}
              />
            </ErrorBoundary>
          </Layout.Side>

          <StickyMain fullWidth>
            <ErrorBoundary>
              <ReplayTimeline />
            </ErrorBoundary>
            <FocusTabs />
          </StickyMain>

          <StyledLayoutMain fullWidth>
            <ErrorBoundary>
              <FocusArea replay={replay} />
            </ErrorBoundary>
          </StyledLayoutMain>
        </Layout.Body>
      </DetailLayout>
    </ReplayContextProvider>
  );
}

const StickyMain = styled(Layout.Main)`
  position: sticky;
  top: 0;
  z-index: ${p => p.theme.zIndex.header};

  /* Make this component full-bleed, so the background covers everything underneath it */
  margin: -${space(1.5)} -${space(4)} -${space(3)};
  padding: ${space(1.5)} ${space(4)} 0;
  max-width: none;
  background: ${p => p.theme.background};
`;

const StyledLayoutMain = styled(Layout.Main)`
  ${HeaderContainer} {
    position: relative;
  }
`;

export default ReplayDetails;
