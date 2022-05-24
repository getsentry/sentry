import React from 'react';
import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import CompactSelect from 'sentry/components/forms/compactSelect';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {IconArrow, IconPause, IconPlay, IconRefresh, IconResize} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import useFullscreen from 'sentry/utils/replays/hooks/useFullscreen';

import {formatTime} from './utils';

const SECOND = 1000;

interface Props {
  speedOptions?: number[];
  toggleFullscreen?: () => void;
}

function ReplayPlayPauseBar() {
  const {currentTime, isPlaying, setCurrentTime, togglePlayPause} = useReplayContext();

  return (
    <ButtonBar merged>
      <Button
        size="xsmall"
        title={t('Go back 10 seconds')}
        icon={<IconRefresh size="sm" />}
        onClick={() => setCurrentTime(currentTime - 10 * SECOND)}
        aria-label={t('Go back 10 seconds')}
      />
      <Button
        size="xsmall"
        title={isPlaying ? t('Pause the Replay') : t('Play the Replay')}
        icon={isPlaying ? <IconPause size="sm" /> : <IconPlay size="sm" />}
        onClick={() => togglePlayPause(!isPlaying)}
        aria-label={isPlaying ? t('Pause the Replay') : t('Play the Replay')}
      />
      <Button
        size="xsmall"
        title={t('Go forward 10 seconds')}
        icon={<IconClockwise size="sm" />}
        onClick={() => setCurrentTime(currentTime + 10 * SECOND)}
        aria-label={t('Go forward 10 seconds')}
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
        size: 'xsmall',
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
        size="xsmall"
        title={t('Fast-forward idle moments')}
        aria-label={t('Fast-forward idle moments')}
        icon={<IconArrow size="sm" direction="right" />}
        priority={isSkippingInactive ? 'primary' : undefined}
        onClick={() => toggleSkipInactive(!isSkippingInactive)}
      />

      <ReplayPlaybackSpeed speedOptions={speedOptions} />

      <Button
        size="xsmall"
        title={isFullscreen ? t('Exit full screen') : t('View in full screen')}
        aria-label={isFullscreen ? t('Exit full screen') : t('View in full screen')}
        icon={<IconResize size="sm" />}
        priority={isFullscreen ? 'primary' : undefined}
        onClick={toggleFullscreen}
      />
    </ButtonGrid>
  );
};

const IconClockwise = styled(IconRefresh)`
  transform: scaleX(-1);
`;

const ButtonGrid = styled('div')`
  display: grid;
  grid-column-gap: ${space(1)};
  grid-template-columns: max-content auto max-content max-content max-content;
  align-items: center;
`;

export default ReplayControls;
