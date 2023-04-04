import {useCallback, useLayoutEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {useResizeObserver} from '@react-aria/utils';

import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {CompositeSelect} from 'sentry/components/compactSelect/composite';
import {PlayerScrubber} from 'sentry/components/replays/player/scrubber';
import useScrubberMouseTracking from 'sentry/components/replays/player/useScrubberMouseTracking';
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
import {space} from 'sentry/styles/space';
import {BreadcrumbType} from 'sentry/types/breadcrumbs';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {getNextReplayEvent} from 'sentry/utils/replays/getReplayEvent';
import useFullscreen from 'sentry/utils/replays/hooks/useFullscreen';
import useOrganization from 'sentry/utils/useOrganization';

const SECOND = 1000;

const COMPACT_WIDTH_BREAKPOINT = 500;

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

const ReplayPlayPauseBar = () => {
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
      <Button
        size="sm"
        title={t('Rewind 10s')}
        icon={<IconRewind10 size="sm" />}
        onClick={() => setCurrentTime(currentTime - 10 * SECOND)}
        aria-label={t('Rewind 10 seconds')}
      />
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
      <Button
        size="sm"
        title={t('Next breadcrumb')}
        icon={<IconNext size="sm" />}
        onClick={() => {
          const startTimestampMs = replay?.getReplay().started_at?.getTime();
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
    </ButtonBar>
  );
};

const ReplayOptionsMenu = ({speedOptions}: {speedOptions: number[]}) => {
  const {setSpeed, speed, isSkippingInactive, toggleSkipInactive} = useReplayContext();
  const SKIP_OPTION_VALUE = 'skip';

  return (
    <CompositeSelect
      trigger={triggerProps => (
        <Button
          {...triggerProps}
          size="sm"
          title={t('Settings')}
          aria-label={t('Settings')}
          icon={<IconSettings size="sm" />}
        />
      )}
    >
      <CompositeSelect.Region
        label={t('Playback Speed')}
        value={speed}
        onChange={opt => setSpeed(opt.value)}
        options={speedOptions.map(option => ({
          label: `${option}x`,
          value: option,
        }))}
      />
      <CompositeSelect.Region
        aria-label={t('Fast-Forward Inactivity')}
        multiple
        value={isSkippingInactive ? [SKIP_OPTION_VALUE] : []}
        onChange={opts => {
          toggleSkipInactive(opts.length > 0);
        }}
        options={[
          {
            label: t('Fast-forward inactivity'),
            value: SKIP_OPTION_VALUE,
          },
        ]}
      />
    </CompositeSelect>
  );
};

const ReplayControls = ({
  toggleFullscreen,
  speedOptions = [0.1, 0.25, 0.5, 1, 2, 4, 8, 16],
}: Props) => {
  const config = useLegacyStore(ConfigStore);
  const organization = useOrganization();
  const barRef = useRef<HTMLDivElement>(null);
  const [isCompact, setIsCompact] = useState(false);
  const {isFullscreen} = useFullscreen();

  const {currentTime, replay} = useReplayContext();
  const durationMs = replay?.getDurationMs();

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

  const updateIsCompact = useCallback(() => {
    const {width} = barRef.current?.getBoundingClientRect() ?? {
      width: COMPACT_WIDTH_BREAKPOINT,
    };
    setIsCompact(width < COMPACT_WIDTH_BREAKPOINT);
  }, []);

  useResizeObserver({
    ref: barRef,
    onResize: updateIsCompact,
  });
  useLayoutEffect(() => updateIsCompact, [updateIsCompact]);

  const elem = useRef<HTMLDivElement>(null);
  const mouseTrackingProps = useScrubberMouseTracking({elem});

  return (
    <ButtonGrid ref={barRef} isCompact={isCompact}>
      <ReplayPlayPauseBar />
      <TimeAndScrubber isCompact={isCompact}>
        <Time>{formatTime(currentTime)}</Time>
        <StyledScrubber ref={elem} {...mouseTrackingProps}>
          <PlayerScrubber />
        </StyledScrubber>
        <Time>{durationMs ? formatTime(durationMs) : '--:--'}</Time>
      </TimeAndScrubber>
      <ButtonBar gap={1}>
        <ReplayOptionsMenu speedOptions={speedOptions} />
        <Button
          size="sm"
          title={isFullscreen ? t('Exit full screen') : t('Enter full screen')}
          aria-label={isFullscreen ? t('Exit full screen') : t('Enter full screen')}
          icon={isFullscreen ? <IconContract size="sm" /> : <IconExpand size="sm" />}
          onClick={handleFullscreenToggle}
        />
      </ButtonBar>
    </ButtonGrid>
  );
};

const ButtonGrid = styled('div')<{isCompact: boolean}>`
  display: flex;
  gap: 0 ${space(1)};
  flex-direction: row;
  justify-content: space-between;
  ${p => (p.isCompact ? `flex-wrap: wrap;` : '')}
`;

const TimeAndScrubber = styled('div')<{isCompact: boolean}>`
  width: 100%;
  display: grid;
  grid-column-gap: ${space(1.5)};
  grid-template-columns: max-content auto max-content;
  align-items: center;
  ${p =>
    p.isCompact
      ? `
        order: -1;
        min-width: 100%;
        margin-top: -8px;
      `
      : ''}
`;

const Time = styled('span')`
  font-variant-numeric: tabular-nums;
`;

const StyledScrubber = styled('div')`
  height: 32px;
  display: flex;
  align-items: center;
`;

export default ReplayControls;
