import {Fragment, useState} from 'react';
import {css} from '@emotion/react';

import {Button} from 'sentry/components/button';
import SentryAppLink from 'sentry/components/devtoolbar/components/sentryAppLink';
import {listItemPlaceholderWrapperCss} from 'sentry/components/devtoolbar/styles/listItem';
import {
  resetFlexColumnCss,
  resetFlexRowCss,
} from 'sentry/components/devtoolbar/styles/reset';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import Placeholder from 'sentry/components/placeholder';
import TextOverflow from 'sentry/components/textOverflow';
import TimeSince from 'sentry/components/timeSince';
import {IconPause, IconPlay} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {PlatformKey} from 'sentry/types/project';

import useConfiguration from '../../hooks/useConfiguration';
import {panelInsetContentCss, panelSectionCss} from '../../styles/panel';
import {smallCss} from '../../styles/typography';
import PanelLayout from '../panelLayout';

export function StartReplayButton({
  setReplayId,
}: {
  setReplayId: React.Dispatch<React.SetStateAction<string | undefined>>;
}) {
  const {SentrySDK} = useConfiguration();
  const replay = SentrySDK && 'getReplay' in SentrySDK && SentrySDK.getReplay();

  const [isStarted, setIsStarted] = useState(false);

  return (
    <Button
      size="sm"
      icon={isStarted ? <IconPause /> : <IconPlay />}
      disabled={!replay}
      onClick={() => {
        if (replay) {
          try {
            isStarted ? replay.stop() : replay.start();
          } catch (err) {
            console.error(err);
          }
          setIsStarted(!isStarted);

          let replayId: string | undefined;
          try {
            console.log('getting replay id');
            replayId = replay.getReplayId();
          } catch (err) {
            console.error(err);
          }
          setReplayId(replayId); // always sets/refreshes
        }
      }}
    >
      {isStarted
        ? t('A replay recording is in progress.')
        : t('Start recording the current session')}
    </Button>
  );
}

const TRUNC_ID_LENGTH = 10; // TODO: import this from somewhere else? Wrap/make dynamic?

export default function ReleasesPanel() {
  // const {data, isLoading, isError} = useToolbarRelease();
  const [isLoading, isError] = [false, false];

  const {organizationSlug, projectSlug, projectId, projectPlatform, trackAnalytics} =
    useConfiguration();

  const estimateSize = 515;
  const placeholderHeight = `${estimateSize - 8}px`; // The real height of the items, minus the padding-block value

  const [replayId, setReplayId] = useState<string | undefined>(undefined); // b7908c02c0ea40f081077a84d887d1f6
  console.log(replayId);

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
          <StartReplayButton setReplayId={setReplayId} />
          <div css={[smallCss, panelSectionCss, panelInsetContentCss]}>
            {replayId !== undefined ? (
              <span css={[resetFlexRowCss, {gap: 'var(--space50)'}]}>
                {'Replay of current session: '}
                <SentryAppLink
                  to={{
                    url: `/replays/${replayId}`, // ?project=11276&query=...
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
                    {/* TODO: can truncate if too 32 char is too long */}
                    {replayId.slice(0, TRUNC_ID_LENGTH)}
                  </div>
                </SentryAppLink>
              </span>
            ) : null}
          </div>
          {/* TODO: add DURATION and start time, similar to replay index page */}
          {/* {'1 min ago 01:12'} */}
        </Fragment>
      )}
    </PanelLayout>
  );
}
