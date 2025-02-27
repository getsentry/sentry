import {useContext, useState} from 'react';
import {css} from '@emotion/react';

import AnalyticsProvider, {
  AnalyticsContext,
} from 'sentry/components/devtoolbar/components/analyticsProvider';
import SentryAppLink from 'sentry/components/devtoolbar/components/sentryAppLink';
import useReplayRecorder from 'sentry/components/devtoolbar/hooks/useReplayRecorder';
import {resetButtonCss, resetFlexRowCss} from 'sentry/components/devtoolbar/styles/reset';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {IconPause, IconPlay} from 'sentry/icons';
import type {PlatformKey} from 'sentry/types/project';

import useConfiguration from '../../hooks/useConfiguration';
import {panelInsetContentCss, panelSectionCss} from '../../styles/panel';
import {smallCss} from '../../styles/typography';
import PanelLayout from '../panelLayout';

const TRUNC_ID_LENGTH = 16;

export default function ReplayPanel() {
  const {trackAnalytics} = useConfiguration();

  const {
    disabledReason,
    isDisabled,
    isRecording,
    lastReplayId,
    recordingMode,
    startRecordingSession,
    stopRecording,
  } = useReplayRecorder();
  const isRecordingSession = isRecording && recordingMode === 'session';

  const {eventName, eventKey} = useContext(AnalyticsContext);
  const [buttonLoading, setButtonLoading] = useState(false);
  return (
    <PanelLayout title="Session Replay" showProjectBadge link={{url: '/replays/'}}>
      {isDisabled ? (
        <p css={[panelInsetContentCss]}>{disabledReason}</p>
      ) : (
        <button
          css={[resetButtonCss]}
          disabled={isDisabled || buttonLoading}
          onClick={async () => {
            setButtonLoading(true);
            if (isRecordingSession) {
              await stopRecording();
            } else {
              await startRecordingSession();
            }
            setButtonLoading(false);
            const type = isRecordingSession ? 'stop' : 'start';
            trackAnalytics?.({
              eventKey: eventKey + `.${type}-button-click`,
              eventName: eventName + `${type} button clicked`,
            });
          }}
        >
          {isRecordingSession ? <IconPause /> : <IconPlay />}
          {isRecordingSession
            ? 'Recording in progress, click to stop'
            : isRecording
              ? 'Replay buffering, click to flush and record'
              : 'Start recording the current session'}
        </button>
      )}
      <div css={[smallCss, panelSectionCss, panelInsetContentCss]}>
        {lastReplayId ? (
          <span
            css={[
              resetFlexRowCss,
              css`
                gap: var(--space50);
              `,
            ]}
          >
            {isRecording ? 'Current replay: ' : 'Last recorded replay: '}
            <AnalyticsProvider keyVal="replay-details-link" nameVal="replay details link">
              <ReplayLink lastReplayId={lastReplayId} />
            </AnalyticsProvider>
          </span>
        ) : (
          'No replay is recording this session.'
        )}
      </div>
    </PanelLayout>
  );
}

function ReplayLink({lastReplayId}: {lastReplayId: string}) {
  const {projectSlug, projectId, projectPlatform} = useConfiguration();
  return (
    <SentryAppLink
      to={{
        url: `/replays/${lastReplayId}/`,
        query: {project: projectId},
      }}
    >
      <div
        css={[
          resetFlexRowCss,
          css`
            display: inline-flex;
            gap: var(--space50);
            align-items: center;
          `,
        ]}
      >
        <ProjectBadge
          css={css`
            && img {
              box-shadow: none;
            }
          `}
          project={{
            slug: projectSlug,
            id: projectId,
            platform: projectPlatform as PlatformKey,
          }}
          avatarSize={16}
          hideName
          avatarProps={{hasTooltip: true}}
        />
        {lastReplayId.slice(0, TRUNC_ID_LENGTH)}
      </div>
    </SentryAppLink>
  );
}
