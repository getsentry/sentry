import React, {useState} from 'react';
import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import BooleanField from 'sentry/components/forms/booleanField';
import RangeSlider from 'sentry/components/forms/controls/rangeSlider';
import {Consumer as ReplayContextProvider} from 'sentry/components/replays/replayContext';
import {IconPause, IconPlay, IconRefresh, IconResize} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';

import useRAF from './useRAF';
import {formatTime} from './utils';

const SECOND = 1000;

function useCurrentTime(callback: () => number) {
  const [currentTime, setCurrentTime] = useState(0);
  useRAF(() => setCurrentTime(callback));
  return currentTime;
}

interface ReplayControllerProps {
  onFullscreen?: () => void;
  speedOptions?: number[];
}

interface ControlsProps extends Required<ReplayControllerProps> {
  duration: number | undefined;
  getCurrentTime: () => number;
  isPlaying: boolean;
  isSkippingInactive: boolean;
  onChangeSpeed: (value: number) => void;
  setCurrentTime: (time: number) => void;
  speed: number;
  togglePlayPause: (play: boolean) => void;
  toggleSkipInactive: (skip: boolean) => void;
}

const ReplayControls = ({
  duration,
  getCurrentTime,
  isPlaying,
  isSkippingInactive,
  onChangeSpeed,
  onFullscreen,
  setCurrentTime,
  speed,
  speedOptions,
  togglePlayPause,
  toggleSkipInactive,
}: ControlsProps) => {
  const currentTime = useCurrentTime(getCurrentTime);

  return (
    <FlexLayout direction="column" gap={0}>
      <TimelineRange
        data-test-id="replay-timeline-range"
        name="repaly-timeline"
        min={0}
        max={duration}
        value={Math.round(currentTime)}
        onChange={value => setCurrentTime(value || 0)}
        showLabel={false}
      />
      <ButtonLayout>
        <FlexLayout direction="row" alignItems="center">
          <ButtonBar merged>
            <Button
              data-test-id="replay-back-10s"
              size="xsmall"
              title={t('Go back 10 seconds')}
              icon={<IconRefresh color="gray500" size="sm" />}
              onClick={() => setCurrentTime(currentTime - 10 * SECOND)}
              aria-label={t('Jump back 10 seconds')}
            />
            <Button
              data-test-id="replay-play-pause"
              size="xsmall"
              title={isPlaying ? t('Pause the Replay') : t('Play the Replay')}
              icon={isPlaying ? <IconPause size="sm" /> : <IconPlay size="sm" />}
              onClick={() => togglePlayPause(!isPlaying)}
              aria-label={t('Toggle real-time updates')}
            />
            <Button
              data-test-id="replay-forward-10s"
              size="xsmall"
              title={t('Go forwards 10 seconds')}
              icon={<IconRefresh color="gray500" size="sm" />}
              onClick={() => setCurrentTime(currentTime + 10 * SECOND)}
              aria-label={t('Jump forward 10 seconds')}
            />
          </ButtonBar>
          <span>
            {formatTime(currentTime)} / {duration ? formatTime(duration) : '??:??'}
          </span>
        </FlexLayout>
        <FlexLayout direction="row">
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
                onClick={() => onChangeSpeed(opt)}
                title={t('Set playback speed to %s', `${opt}x`)}
              >
                {opt}x
              </Button>
            ))}
          </ButtonBar>

          <Button
            data-test-id="replay-fullscreen"
            size="xsmall"
            title={t('View the Replay in full screen')}
            icon={<IconResize size="sm" />}
            onClick={() => onFullscreen()}
            aria-label={t('View in full screen')}
          />
        </FlexLayout>
      </ButtonLayout>
    </FlexLayout>
  );
};

type FlexDirectionValues =
  | 'row'
  | 'row-reverse'
  | 'column'
  | 'column-reverse'
  | 'inherit'
  | 'initial'
  | 'revert'
  | 'revert-layer'
  | 'unset';

type AlignItemsValues =
  | 'normal'
  | 'stretch'
  | 'center'
  | 'start'
  | 'end'
  | 'flex-start'
  | 'flex-end'
  | 'baseline'
  | 'first baseline'
  | 'last baseline'
  | 'safe center'
  | 'unsafe center'
  | 'inherit'
  | 'initial'
  | 'revert'
  | 'revert-layer'
  | 'unset';

const FlexLayout = styled('div')<{
  alignItems?: AlignItemsValues;
  direction?: FlexDirectionValues;
  gap?: Parameters<typeof space>[0];
}>`
  display: flex;
  flex-direction: ${p => p.direction ?? 'initial'};
  gap: ${p => space(p.gap ?? 1)};
  align-items: ${p => p.alignItems ?? 'initial'};
`;

const ButtonLayout = styled('div')`
  display: flex;
  justify-content: space-between;
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
  onFullscreen = () => {},
  speedOptions = [0.5, 1, 2, 4],
}: ReplayControllerProps) {
  return (
    <ReplayContextProvider>
      {({
        duration,
        getCurrentTime,
        handleSpeedChange,
        isPlaying,
        setCurrentTime,
        skipInactive,
        speed,
        togglePlayPause,
        toggleSkipInactive,
      }) => {
        return (
          <ReplayControls
            duration={duration}
            getCurrentTime={getCurrentTime}
            isPlaying={isPlaying}
            isSkippingInactive={skipInactive}
            onChangeSpeed={handleSpeedChange}
            onFullscreen={onFullscreen}
            setCurrentTime={setCurrentTime}
            speed={speed}
            speedOptions={speedOptions}
            togglePlayPause={togglePlayPause}
            toggleSkipInactive={toggleSkipInactive}
          />
        );
      }}
    </ReplayContextProvider>
  );
}
