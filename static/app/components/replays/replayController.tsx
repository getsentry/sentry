import React from 'react';
import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {transformCrumbs} from 'sentry/components/events/interfaces/breadcrumbs/utils';
import CompactSelect from 'sentry/components/forms/compactSelect';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {formatTime, relativeTimeInMs} from 'sentry/components/replays/utils';
import {
  IconArrow,
  IconNext,
  IconPause,
  IconPlay,
  IconPrevious,
  IconRefresh,
  IconResize,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {BreadcrumbType} from 'sentry/types/breadcrumbs';
import {getNextBreadcrumb} from 'sentry/utils/replays/getBreadcrumb';
import useFullscreen from 'sentry/utils/replays/hooks/useFullscreen';

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

function ReplayPlayPauseBar() {
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
        size="xs"
        title={t('Go back 10 seconds')}
        icon={<IconRefresh size="sm" />}
        onClick={() => setCurrentTime(currentTime - 10 * SECOND)}
        aria-label={t('Go back 10 seconds')}
      />
      {isFinished ? (
        <Button
          size="xs"
          title={t('Restart Replay')}
          icon={<IconPrevious size="sm" />}
          onClick={restart}
          aria-label={t('Restart the Replay')}
        />
      ) : (
        <Button
          size="xs"
          title={isPlaying ? t('Pause the Replay') : t('Play the Replay')}
          icon={isPlaying ? <IconPause size="sm" /> : <IconPlay size="sm" />}
          onClick={() => togglePlayPause(!isPlaying)}
          aria-label={isPlaying ? t('Pause the Replay') : t('Play the Replay')}
        />
      )}
      <Button
        size="xs"
        title={t('Jump to next event')}
        icon={<IconNext size="sm" />}
        onClick={() => {
          const startTimestampSec = replay?.getEvent().startTimestamp;
          if (!startTimestampSec) {
            return;
          }
          const transformedCrumbs = transformCrumbs(replay?.getRawCrumbs() || []);
          const next = getNextBreadcrumb({
            crumbs: transformedCrumbs.filter(crumb => USER_ACTIONS.includes(crumb.type)),
            targetTimestampMs: startTimestampSec * 1000 + currentTime,
          });

          if (startTimestampSec !== undefined && next?.timestamp) {
            setCurrentTime(relativeTimeInMs(next.timestamp, startTimestampSec));
          }
        }}
        aria-label={t('Jump to next event')}
      />
    </ButtonBar>
  );
}

function ReplayCurrentTime() {
  const {currentTime, duration} = useReplayContext();

  return (
    <span>
      {formatTime(currentTime)} / {duration ? formatTime(duration) : '??:??'}
    </span>
  );
}

function ReplayPlaybackSpeed({speedOptions}: {speedOptions: number[]}) {
  const {setSpeed, speed} = useReplayContext();
  return (
    <CompactSelect
      triggerProps={{
        size: 'xs',
        prefix: t('Speed'),
      }}
      value={speed}
      options={speedOptions.map(speedOption => ({
        value: speedOption,
        label: `${speedOption}x`,
        disabled: speedOption === speed,
      }))}
      onChange={opt => {
        setSpeed(opt.value);
      }}
    />
  );
}

const ReplayControls = ({
  toggleFullscreen = () => {},
  speedOptions = [0.1, 0.25, 0.5, 1, 2, 4],
}: Props) => {
  const {isFullscreen} = useFullscreen();
  const {isSkippingInactive, toggleSkipInactive} = useReplayContext();

  return (
    <ButtonGrid>
      <ReplayPlayPauseBar />
      <ReplayCurrentTime />

      {/* TODO(replay): Need a better icon for the FastForward toggle */}
      <Button
        size="xs"
        title={t('Fast-forward idle moments')}
        aria-label={t('Fast-forward idle moments')}
        icon={<IconArrow size="sm" direction="right" />}
        priority={isSkippingInactive ? 'primary' : undefined}
        onClick={() => toggleSkipInactive(!isSkippingInactive)}
      />

      <ReplayPlaybackSpeed speedOptions={speedOptions} />

      <Button
        size="xs"
        title={isFullscreen ? t('Exit full screen') : t('View in full screen')}
        aria-label={isFullscreen ? t('Exit full screen') : t('View in full screen')}
        icon={<IconResize size="sm" />}
        priority={isFullscreen ? 'primary' : undefined}
        onClick={toggleFullscreen}
      />
    </ButtonGrid>
  );
};

const ButtonGrid = styled('div')`
  display: grid;
  grid-column-gap: ${space(1)};
  grid-template-columns: max-content auto max-content max-content max-content;
  align-items: center;
`;

export default ReplayControls;
