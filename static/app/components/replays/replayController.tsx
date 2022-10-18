import React, {useCallback, useLayoutEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {useResizeObserver} from '@react-aria/utils';

import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import CompositeSelect from 'sentry/components/compositeSelect';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {formatTime, relativeTimeInMs} from 'sentry/components/replays/utils';
import {
  IconContract,
  IconExpand,
  IconNext,
  IconPause,
  IconPlay,
  IconPrevious,
  IconRewind10,
  IconSettings,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import space from 'sentry/styles/space';
import {SelectValue} from 'sentry/types';
import {BreadcrumbType} from 'sentry/types/breadcrumbs';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {getNextReplayEvent} from 'sentry/utils/replays/getReplayEvent';
import useFullscreen from 'sentry/utils/replays/hooks/useFullscreen';
import useOrganization from 'sentry/utils/useOrganization';

const SECOND = 1000;

const USER_ACTIONS = [
  BreadcrumbType.ERROR,
  BreadcrumbType.INIT,
  BreadcrumbType.NAVIGATION,
  BreadcrumbType.UI,
  BreadcrumbType.USER,
];

interface Props {
  speedOptions?: number[];
  toggleFullscreen?: () => void;
}

function ReplayPlayPauseBar({isCompact}: {isCompact: boolean}) {
  const {
    currentTime,
    isFinished,
    isPlaying,
    replay,
    restart,
    setCurrentTime,
    togglePlayPause,
  } = useReplayContext();

  return (
    <ButtonBar merged>
      {!isCompact && (
        <Button
          size="sm"
          title={t('Rewind 10s')}
          icon={<IconRewind10 size="sm" />}
          onClick={() => setCurrentTime(currentTime - 10 * SECOND)}
          aria-label={t('Rewind 10 seconds')}
        />
      )}
      {isFinished ? (
        <Button
          size="sm"
          title={t('Restart Replay')}
          icon={<IconPrevious size="sm" />}
          onClick={restart}
          aria-label={t('Restart Replay')}
        />
      ) : (
        <Button
          size="sm"
          title={isPlaying ? t('Pause') : t('Play')}
          icon={isPlaying ? <IconPause size="sm" /> : <IconPlay size="sm" />}
          onClick={() => togglePlayPause(!isPlaying)}
          aria-label={isPlaying ? t('Pause') : t('Play')}
        />
      )}
      {!isCompact && (
        <Button
          size="sm"
          title={t('Next breadcrumb')}
          icon={<IconNext size="sm" />}
          onClick={() => {
            const startTimestampMs = replay?.getReplay().startedAt?.getTime();
            if (!startTimestampMs) {
              return;
            }
            const transformedCrumbs = replay?.getRawCrumbs() || [];
            const next = getNextReplayEvent({
              items: transformedCrumbs.filter(crumb => USER_ACTIONS.includes(crumb.type)),
              targetTimestampMs: startTimestampMs + currentTime,
            });

            if (startTimestampMs !== undefined && next?.timestamp) {
              setCurrentTime(relativeTimeInMs(next.timestamp, startTimestampMs));
            }
          }}
          aria-label={t('Fast-forward to next breadcrumb')}
        />
      )}
    </ButtonBar>
  );
}

function ReplayCurrentTime() {
  const {currentTime, replay} = useReplayContext();
  const durationMs = replay?.getDurationMs();

  return (
    <span>
      {formatTime(currentTime)} / {durationMs ? formatTime(durationMs) : '--:--'}
    </span>
  );
}

function ReplayOptionsMenu({speedOptions}: {speedOptions: number[]}) {
  const {setSpeed, speed, isSkippingInactive, toggleSkipInactive} = useReplayContext();
  const SKIP_OPTION_VALUE = 'skip';

  return (
    <CompositeSelect<SelectValue<string | number>>
      trigger={triggerProps => (
        <Button
          {...triggerProps}
          size="sm"
          title={t('Settings')}
          aria-label={t('Settings')}
          icon={<IconSettings size="sm" />}
        />
      )}
      sections={[
        {
          defaultValue: speed,
          label: t('Playback Speed'),
          value: 'playback_speed',
          onChange: setSpeed,
          options: speedOptions.map(option => ({
            label: `${option}x`,
            value: option,
          })),
        },
        {
          multiple: true,
          defaultValue: isSkippingInactive ? [SKIP_OPTION_VALUE] : [],
          label: '',
          value: 'fast_forward',
          onChange: (value: typeof SKIP_OPTION_VALUE[]) => {
            toggleSkipInactive(value.length > 0);
          },
          options: [
            {
              label: t('Fast-forward inactivity'),
              value: SKIP_OPTION_VALUE,
            },
          ],
        },
      ]}
    />
  );
}

const ReplayControls = ({
  toggleFullscreen,
  speedOptions = [0.1, 0.25, 0.5, 1, 2, 4],
}: Props) => {
  const config = useLegacyStore(ConfigStore);
  const organization = useOrganization();
  const barRef = useRef<HTMLDivElement>(null);
  const [compactLevel, setCompactLevel] = useState(0);
  const {isFullscreen} = useFullscreen();

  const handleFullscreenToggle = () => {
    if (toggleFullscreen) {
      trackAdvancedAnalyticsEvent('replay.toggle-fullscreen', {
        organization,
        user_email: config.user.email,
        fullscreen: !isFullscreen,
      });
      toggleFullscreen();
    }
  };

  const updateCompactLevel = useCallback(() => {
    const {width} = barRef.current?.getBoundingClientRect() ?? {width: 500};
    if (width < 400) {
      setCompactLevel(1);
    } else {
      setCompactLevel(0);
    }
  }, []);

  useResizeObserver({
    ref: barRef,
    onResize: updateCompactLevel,
  });
  useLayoutEffect(() => updateCompactLevel, [updateCompactLevel]);

  return (
    <ButtonGrid ref={barRef}>
      <ReplayPlayPauseBar isCompact={compactLevel > 0} />
      <ReplayCurrentTime />

      <ReplayOptionsMenu speedOptions={speedOptions} />
      <Button
        size="sm"
        title={isFullscreen ? t('Exit full screen') : t('Enter full screen')}
        aria-label={isFullscreen ? t('Exit full screen') : t('Enter full screen')}
        icon={isFullscreen ? <IconContract size="sm" /> : <IconExpand size="sm" />}
        onClick={handleFullscreenToggle}
      />
    </ButtonGrid>
  );
};

const ButtonGrid = styled('div')`
  display: grid;
  grid-column-gap: ${space(1)};
  grid-template-columns: max-content auto max-content max-content;
  align-items: center;
`;

export default ReplayControls;
