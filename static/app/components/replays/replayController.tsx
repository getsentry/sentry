import React from 'react';
import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import BooleanField from 'sentry/components/forms/booleanField';
import RangeSlider from 'sentry/components/forms/controls/rangeSlider';
import {Panel as BasePanel, PanelBody as BasePanelBody} from 'sentry/components/panels';
import {Consumer as ReplayContextConsumer} from 'sentry/components/replays/replayContext';
import useFullscreen from 'sentry/components/replays/useFullscreen';
import {IconPause, IconPlay, IconRefresh, IconResize} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';

import {formatTime} from './utils';

const SECOND = 1000;

interface ReplayControllerProps {
  speedOptions?: number[];
  toggleFullscreen?: () => void;
}

// A mix of the public `ReplayControllerProps` and props injected by `ReplayContextConsumer`
interface ControlsProps extends Required<ReplayControllerProps> {
  currentTime: number;
  duration: number | undefined;
  isFullscreen: boolean;
  isPlaying: boolean;
  isSkippingInactive: boolean;
  setCurrentTime: (time: number) => void;
  setSpeed: (value: number) => void;
  speed: number;
  togglePlayPause: (play: boolean) => void;
  toggleSkipInactive: (skip: boolean) => void;
}

const ReplayControls = ({
  currentTime,
  duration,
  isFullscreen,
  isPlaying,
  isSkippingInactive,
  setCurrentTime,
  setSpeed,
  speed,
  speedOptions,
  toggleFullscreen,
  togglePlayPause,
  toggleSkipInactive,
}: ControlsProps) => {
  return (
    <React.Fragment>
      <TimelineRange
        data-test-id="replay-timeline-range"
        name="replay-timeline"
        min={0}
        max={duration}
        value={Math.round(currentTime)}
        onChange={value => setCurrentTime(value || 0)}
        showLabel={false}
      />

      <ButtonGrid>
        <ButtonBar merged>
          <Button
            data-test-id="replay-back-10s"
            size="xsmall"
            title={t('Go back 10 seconds')}
            icon={<IconRefresh color="gray500" size="sm" />}
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
            icon={<IconClockwise color="gray500" size="sm" />}
            onClick={() => setCurrentTime(currentTime + 10 * SECOND)}
            aria-label={t('Go forward 10 seconds')}
          />
        </ButtonBar>
        <span>
          {formatTime(currentTime)} / {duration ? formatTime(duration) : '??:??'}
        </span>

        <RightLeftBooleanField
          data-test-id="replay-skip-inactive"
          name="skip-inactive"
          label={t('Skip to events')}
          onChange={() => toggleSkipInactive(!isSkippingInactive)}
          inline={false}
          stacked
          hideControlState
          value={isSkippingInactive}
        />
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
    </React.Fragment>
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

const RightLeftBooleanField = styled(BooleanField)`
  flex-direction: row;
  column-gap: ${space(0.5)};
  align-items: center;
  padding-bottom: 0;

  label {
    /* Align the label with the center of the checkbox */
    margin-bottom: 0;
  }
`;

export default function ReplayController({
  toggleFullscreen = () => {},
  speedOptions = [0.5, 1, 2, 4],
}: ReplayControllerProps) {
  const {isFullscreen} = useFullscreen();

  return (
    <ReplayContextConsumer>
      {({
        currentTime,
        duration,
        isPlaying,
        setCurrentTime,
        setSpeed,
        skipInactive,
        speed,
        togglePlayPause,
        toggleSkipInactive,
      }) => (
        <Panel isFullscreen={isFullscreen}>
          <PanelBody withPadding>
            <ReplayControls
              currentTime={currentTime}
              duration={duration}
              isFullscreen={isFullscreen}
              isPlaying={isPlaying}
              isSkippingInactive={skipInactive}
              setCurrentTime={setCurrentTime}
              setSpeed={setSpeed}
              speed={speed}
              speedOptions={speedOptions}
              toggleFullscreen={toggleFullscreen}
              togglePlayPause={togglePlayPause}
              toggleSkipInactive={toggleSkipInactive}
            />
          </PanelBody>
        </Panel>
      )}
    </ReplayContextConsumer>
  );
}
