import {Fragment, useEffect, useState} from 'react';
import {css} from '@emotion/react';
import type {ReplayRecordingMode} from '@sentry/types';

import {Button} from 'sentry/components/button';
import SentryAppLink from 'sentry/components/devtoolbar/components/sentryAppLink';
import {resetFlexRowCss} from 'sentry/components/devtoolbar/styles/reset';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {IconPause, IconPlay} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {PlatformKey} from 'sentry/types/project';

import useConfiguration from '../../hooks/useConfiguration';
import {panelInsetContentCss, panelSectionCss} from '../../styles/panel';
import {smallCss} from '../../styles/typography';
import PanelLayout from '../panelLayout';

const TRUNC_ID_LENGTH = 16;
const POLL_INTERVAL_MS = 3000;

export default function ReplayPanel() {
  const {projectSlug, projectId, projectPlatform, trackAnalytics, SentrySDK} =
    useConfiguration();
  const replay =
    SentrySDK && 'getReplay' in SentrySDK ? SentrySDK.getReplay() : undefined;

  // sessionId is undefined iff we are recording in session OR buffer mode.
  const [sessionId, setSessionId] = useState<string | undefined>(() =>
    replay?.getReplayId()
  );
  const [recordingMode, setRecordingMode] = useState<ReplayRecordingMode>(
    () => replay?._replay.recordingMode
  );
  // Polls periodically since a replay could be started by sessionSampleRate
  useEffect(() => {
    const intervalId = setInterval(() => {
      setSessionId(replay?.getReplayId());
      setRecordingMode(replay?._replay.recordingMode);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [replay]);

  const [isRecording, setIsRecording] = useState(
    () => replay?.getReplayId() && replay?._replay.recordingMode === 'session'
  );
  useEffect(
    () => setIsRecording(sessionId && recordingMode === 'session'),
    [sessionId, recordingMode]
  );

  // Used to persist the link to the last recorded replay, even if it's stopped.
  // TODO: this is lost after leaving the panel. Could use a local storage?
  const [lastReplayId, setLastReplayId] = useState<string | undefined>(() => {
    return recordingMode === 'session' ? replay?.getReplayId() : undefined;
  });
  useEffect(() => {
    if (sessionId && recordingMode === 'session') {
      setLastReplayId(sessionId);
    }
  }, [sessionId, recordingMode]);

  return (
    <PanelLayout title="Session Replay">
      <Fragment>
        <Button
          size="sm"
          icon={isRecording ? <IconPause /> : <IconPlay />}
          disabled={!replay} // TODO: tooltip on why this is disabled,
          onClick={() => {
            if (replay) {
              if (isRecording) {
                replay.stop(); // stop should call flush
              } else {
                // If we're sampling errors, the we might be in buffering mode.
                // In this case start() will do nothing. flush() will switch to session mode + start recording.
                replay.flush();
              }
              setSessionId(replay.getReplayId()); // this will set isRecording
            }
          }}
        >
          {isRecording
            ? t('In progress. Click to stop recording')
            : t('Start recording the current session')}
        </Button>
        <div css={[smallCss, panelSectionCss, panelInsetContentCss]}>
          {lastReplayId ? (
            <span css={[resetFlexRowCss, {gap: 'var(--space50)'}]}>
              {isRecording ? t('Current replay: ') : t('Last recorded replay: ')}
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
            'No replay'
          )}
        </div>
      </Fragment>
    </PanelLayout>
  );
}
