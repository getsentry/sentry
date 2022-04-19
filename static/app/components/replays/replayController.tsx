import React from 'react';
import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import RangeSlider from 'sentry/components/forms/controls/rangeSlider';
import {Panel as BasePanel, PanelBody as BasePanelBody} from 'sentry/components/panels';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import useFullscreen from 'sentry/components/replays/useFullscreen';
import {IconArrow, IconPause, IconPlay, IconRefresh, IconResize} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';

import {formatTime} from './utils';

const SECOND = 1000;

interface Props {
  speedOptions?: number[];
  toggleFullscreen?: () => void;
}

function ReplayBasicTimeline() {
  const {currentTime, duration, setCurrentTime} = useReplayContext();

  return (
    <TimelineRange
      data-test-id="replay-timeline-range"
      name="replay-timeline"
      min={0}
      max={duration}
      value={Math.round(currentTime)}
      onChange={value => setCurrentTime(value || 0)}
      showLabel={false}
    />
  );
}

function ReplayPlayPauseBar() {
  const {currentTime, isPlaying, setCurrentTime, togglePlayPause} = useReplayContext();

  return (
    <ButtonBar merged>
      <Button
        data-test-id="replay-back-10s"
        size="xsmall"
        title={t('Go back 10 seconds')}
        icon={<IconRefresh size="sm" />}
        onClick={() => setCurrentTime(currentTime - 10 * SECOND)}
        aria-label={t('Go back 10 seconds')}
      />
      <Button
        data-test-id="replay-play-pause"
        size="xsmall"
        title={isPlaying ? t('Pause the Replay') : t('Play the Replay')}
        icon={isPlaying ? <IconPause size="sm" /> : <IconPlay size="sm" />}
        onClick={() => togglePlayPause(!isPlaying)}
        aria-label={isPlaying ? t('Pause the Replay') : t('Play the Replay')}
      />
      <Button
        data-test-id="replay-forward-10s"
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
    <ButtonBar active={String(speed)} merged>
      {speedOptions.map(opt => (
        <Button
          key={opt}
          size="xsmall"
          barId={String(opt)}
          onClick={() => setSpeed(opt)}
          title={t('Set playback speed to %s', `${opt}x`)}
        >
          {opt}x
        </Button>
      ))}
    </ButtonBar>
  );
}

const ReplayControls = ({
  toggleFullscreen = () => {},
  speedOptions = [0.5, 1, 2, 4],
}: Props) => {
  const {isFullscreen} = useFullscreen();
  const {isSkippingInactive, toggleSkipInactive} = useReplayContext();

  return (
    <Panel isFullscreen={isFullscreen}>
      <PanelBody withPadding>
        <ReplayBasicTimeline />

        <ButtonGrid>
          <ReplayPlayPauseBar />
          <ReplayCurrentTime />

          {/* TODO(replay): Need a better icon for the FastForward toggle */}
          <Button
            data-test-id="replay-fast-forward"
            size="xsmall"
            title={t('Fast-forward idle moments')}
            aria-label={t('Fast-forward idle moments')}
            icon={<IconArrow size="sm" direction="right" />}
            priority={isSkippingInactive ? 'primary' : undefined}
            onClick={() => toggleSkipInactive(!isSkippingInactive)}
          />

          <ReplayPlaybackSpeed speedOptions={speedOptions} />

          <Button
            data-test-id="replay-fullscreen"
            size="xsmall"
            title={isFullscreen ? t('Exit full screen') : t('View in full screen')}
            aria-label={isFullscreen ? t('Exit full screen') : t('View in full screen')}
            icon={<IconResize size="sm" />}
            priority={isFullscreen ? 'primary' : undefined}
            onClick={toggleFullscreen}
          />
        </ButtonGrid>
      </PanelBody>
    </Panel>
  );
};

const Panel = styled(BasePanel)<{isFullscreen: boolean}>`
  width: 100%;
  ${p => (p.isFullscreen ? 'margin-bottom: 0;' : '')}
`;

const PanelBody = styled(BasePanelBody)`
  display: grid;
  flex-direction: column;
`;

const IconClockwise = styled(IconRefresh)`
  transform: scaleX(-1);
`;

const ButtonGrid = styled('div')`
  display: grid;
  grid-column-gap: ${space(1)};
  grid-template-columns: max-content auto max-content max-content max-content;
  align-items: center;
`;

const TimelineRange = styled(RangeSlider)`
  flex-grow: 1;
  margin-top: ${space(1)};
`;

export default ReplayControls;
