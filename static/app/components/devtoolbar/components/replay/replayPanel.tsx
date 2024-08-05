import {useContext} from 'react';
import {css} from '@emotion/react';

import {Button} from 'sentry/components/button';
import AnalyticsProvider, {
  AnalyticsContext,
} from 'sentry/components/devtoolbar/components/analyticsProvider';
import SentryAppLink from 'sentry/components/devtoolbar/components/sentryAppLink';
import useReplayRecorder from 'sentry/components/devtoolbar/hooks/useReplayRecorder';
import {resetFlexRowCss} from 'sentry/components/devtoolbar/styles/reset';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import ExternalLink from 'sentry/components/links/externalLink';
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
    useReplayRecorder();

  function ReplayLink({children}: {children: React.ReactNode}) {
    const {eventName, eventKey} = useContext(AnalyticsContext);
    return process.env.NODE_ENV === 'production' ? (
      <SentryAppLink
        to={{
          url: `/replays/${lastReplayId}`,
          query: {project: projectId},
        }}
      >
        {children}
      </SentryAppLink>
    ) : (
      <ExternalLink
        href={`https://sentry-test.sentry.io/replays/${lastReplayId}/?project=5270453`}
        onClick={() => {
          trackAnalytics?.({
            eventKey: eventKey + '.click',
            eventName: eventName + ' clicked',
          });
        }}
      >
        {children}
      </ExternalLink>
    );
  }

  return (
    <PanelLayout title="Session Replay">
      <AnalyticsProvider
        keyVal={`replay-button-${isRecording ? 'stop' : 'start'}`}
        nameVal={`replay button ${isRecording ? 'stop' : 'start'}`}
      >
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
      </AnalyticsProvider>
      <div css={[smallCss, panelSectionCss, panelInsetContentCss]}>
        {lastReplayId ? (
          <span css={[resetFlexRowCss, {gap: 'var(--space50)'}]}>
            {isRecording ? 'Current replay: ' : 'Last recorded replay: '}
            <AnalyticsProvider keyVal="replay-details-link" nameVal="replay details link">
              <ReplayLink>
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
              </ReplayLink>
            </AnalyticsProvider>
          </span>
        ) : (
          'No replay is recording this session.'
        )}
      </div>
    </PanelLayout>
  );
}
