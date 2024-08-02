import {css} from '@emotion/react';

import {Button} from 'sentry/components/button';
import SentryAppLink from 'sentry/components/devtoolbar/components/sentryAppLink';
import useReplayContext from 'sentry/components/devtoolbar/hooks/useReplayContext';
import {resetFlexRowCss} from 'sentry/components/devtoolbar/styles/reset';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {IconPause, IconPlay} from 'sentry/icons';
import type {PlatformKey} from 'sentry/types/project';

import useConfiguration from '../../hooks/useConfiguration';
import {panelInsetContentCss, panelSectionCss} from '../../styles/panel';
import {smallCss} from '../../styles/typography';
import PanelLayout from '../panelLayout';

const TRUNC_ID_LENGTH = 16;

export default function ReplayPanel() {
  const {projectSlug, projectId, projectPlatform, trackAnalytics} = useConfiguration();

  const {disabledReason, isDisabled, isRecording, lastReplayId, start, stop} =
    useReplayContext();

  return (
    <PanelLayout title="Session Replay">
      <Button
        size="sm"
        icon={isRecording ? <IconPause /> : <IconPlay />}
        disabled={isDisabled}
        title={disabledReason}
        onClick={() => (isRecording ? stop() : start())}
      >
        {isRecording
          ? 'In progress. Click to stop recording'
          : 'Start recording the current session'}
      </Button>
      <div css={[smallCss, panelSectionCss, panelInsetContentCss]}>
        {lastReplayId ? (
          <span css={[resetFlexRowCss, {gap: 'var(--space50)'}]}>
            {isRecording ? 'Current replay: ' : 'Last recorded replay: '}
            <SentryAppLink
              to={{
                url: `/replays/${lastReplayId}`,
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
                {lastReplayId.slice(0, TRUNC_ID_LENGTH)}
              </div>
            </SentryAppLink>
          </span>
        ) : (
          'No replay is recording this session.'
        )}
      </div>
    </PanelLayout>
  );
}
