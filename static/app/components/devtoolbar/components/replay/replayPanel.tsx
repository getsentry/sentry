import {Fragment, useState} from 'react';
import {css} from '@emotion/react';
import type {replayIntegration} from '@sentry/react';

import {Button} from 'sentry/components/button';
import SentryAppLink from 'sentry/components/devtoolbar/components/sentryAppLink';
import {listItemPlaceholderWrapperCss} from 'sentry/components/devtoolbar/styles/listItem';
import {
  resetFlexColumnCss,
  resetFlexRowCss,
} from 'sentry/components/devtoolbar/styles/reset';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import Placeholder from 'sentry/components/placeholder';
import {IconPause, IconPlay} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {PlatformKey} from 'sentry/types/project';

import useConfiguration from '../../hooks/useConfiguration';
import {panelInsetContentCss, panelSectionCss} from '../../styles/panel';
import {smallCss} from '../../styles/typography';
import PanelLayout from '../panelLayout';

export function StartReplayButton({
  replay,
  setReplayId,
}: {
  replay: ReturnType<typeof replayIntegration> | undefined | false;
  setReplayId: React.Dispatch<React.SetStateAction<string | undefined>>;
}) {
  const [isStarted, setIsStarted] = useState(false);
  // isStarted is not always accurate, since we don't have an API fx to check if we're currently recording.
  // _replay.recordingMode == "session" is how we'd check w/ the internal API.

  return (
    <Button
      size="sm"
      icon={isStarted ? <IconPause /> : <IconPlay />}
      disabled={!replay} // TODO: tooltip on why this could be disabled
      onClick={() => {
        if (replay) {
          try {
            if (isStarted) {
              replay.stop(); // stop should call flush
            } else {
              // If we're sampling errors, there's a chance the replay will be in buffering mode.
              // In this case start() will do nothing, while flush() will switch to session mode/start recording.
              // However if we're not buffering, flush() will not start a replay (needs more testing).
              // To improve this code we need an API fx to get the recording mode (see above)
              replay.flush();
              replay.start();
            }
          } catch (err) {
            console.error(err);
          } finally {
            setIsStarted(!isStarted); // TODO: improve
          }

          let replayId: string | undefined;
          try {
            replayId = replay.getReplayId();
          } catch (err) {
            console.error(err);
          }
          console.log('Replay ID=', replayId);
          setReplayId(replayId); // always set/refresh regardless of error
        }
      }}
    >
      {isStarted
        ? t('A replay recording is in progress.')
        : t('Start recording the current session')}
    </Button>
  );
}

const TRUNC_ID_LENGTH = 10; // TODO: import this from somewhere else? Make it more dynamic?

export default function ReplayPanel() {
  // TODO: re-estimate. This is from releasesPanel
  const estimateSize = 515;
  const placeholderHeight = `${estimateSize - 8}px`; // The real height of the items, minus the padding-block value

  const {projectSlug, projectId, projectPlatform, trackAnalytics, SentrySDK} =
    useConfiguration();
  const replay = SentrySDK && 'getReplay' in SentrySDK && SentrySDK.getReplay();
  const [replayId, setReplayId] = useState<string | undefined>(() => {
    try {
      if (replay) {
        return replay.getReplayId();
      }
    } catch {
      return undefined;
    }
    return undefined;
  });
  console.log('Replay ID=', replayId);

  const [isLoading, isError] = [false, false]; // TODO: use if we query an endpoint for data like time started

  return (
    <PanelLayout title="Session Replay">
      {isLoading || isError ? (
        <div
          css={[
            resetFlexColumnCss,
            panelSectionCss,
            panelInsetContentCss,
            listItemPlaceholderWrapperCss,
          ]}
        >
          <Placeholder height={placeholderHeight} />
        </div>
      ) : (
        <Fragment>
          <StartReplayButton setReplayId={setReplayId} replay={replay} />
          <div css={[smallCss, panelSectionCss, panelInsetContentCss]}>
            {replayId !== undefined ? (
              <span css={[resetFlexRowCss, {gap: 'var(--space50)'}]}>
                {'Replay of current session: '}
                <SentryAppLink
                  to={{
                    url: `/replays/${replayId}`,
                    query: {project: projectId},
                  }}
                  onClick={() => {
                    trackAnalytics?.({
                      eventKey: `devtoolbar.current-replay-link.click`,
                      eventName: `devtoolbar: Current replay link clicked`,
                    });
                  }}
                >
                  <div
                    css={[
                      resetFlexRowCss,
                      {
                        display: 'inline-flex',
                        gap: 'var(--space50)',
                        alignItems: 'center',
                      },
                    ]}
                  >
                    <ProjectBadge
                      css={css({'&& img': {boxShadow: 'none'}})}
                      project={{
                        slug: projectSlug,
                        id: projectId,
                        platform: projectPlatform as PlatformKey,
                      }}
                      avatarSize={16}
                      hideName
                      avatarProps={{hasTooltip: false}}
                    />
                    {replayId.slice(0, TRUNC_ID_LENGTH)}
                  </div>
                </SentryAppLink>
              </span>
            ) : (
              'No replay'
            )}
          </div>
          {/* TODO: add DURATION and start time, similar to replay index page */}
          {/* {'1 min ago 01:12'} */}
        </Fragment>
      )}
    </PanelLayout>
  );
}
