import {useCallback, useLayoutEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {useResizeObserver} from '@react-aria/utils';

import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {CompositeSelect} from 'sentry/components/compactSelect/composite';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {ReplayFullscreenButton} from 'sentry/components/replays/replayFullscreenButton';
import ReplayPlayPauseButton from 'sentry/components/replays/replayPlayPauseButton';
import TimeAndScrubberGrid from 'sentry/components/replays/timeAndScrubberGrid';
import {IconNext, IconRewind10, IconSettings} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {getNextReplayFrame} from 'sentry/utils/replays/getReplayEvent';

const SECOND = 1000;

const COMPACT_WIDTH_BREAKPOINT = 500;

interface Props {
  toggleFullscreen: () => void;
  hideFastForward?: boolean;
  speedOptions?: number[];
}

function ReplayPlayPauseBar() {
  const {currentTime, replay, setCurrentTime} = useReplayContext();

  return (
    <ButtonBar gap={1}>
      <Button
        size="sm"
        title={t('Rewind 10s')}
        icon={<IconRewind10 size="sm" />}
        onClick={() => setCurrentTime(currentTime - 10 * SECOND)}
        aria-label={t('Rewind 10 seconds')}
      />
      <ReplayPlayPauseButton />
      <Button
        size="sm"
        title={t('Next breadcrumb')}
        icon={<IconNext size="sm" />}
        onClick={() => {
          if (!replay) {
            return;
          }
          const next = getNextReplayFrame({
            frames: replay.getChapterFrames(),
            targetOffsetMs: currentTime,
          });

          if (next) {
            setCurrentTime(next.offsetMs);
          }
        }}
        aria-label={t('Fast-forward to next breadcrumb')}
      />
    </ButtonBar>
  );
}

function ReplayOptionsMenu({
  speedOptions,
  hideFastForward = false,
}: {
  hideFastForward: boolean;
  speedOptions: number[];
}) {
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
      {!hideFastForward && (
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
      )}
    </CompositeSelect>
  );
}

function ReplayControls({
  toggleFullscreen,
  hideFastForward = false,
  speedOptions = [0.1, 0.25, 0.5, 1, 2, 4, 8, 16],
}: Props) {
  const barRef = useRef<HTMLDivElement>(null);
  const [isCompact, setIsCompact] = useState(false);

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

  return (
    <ButtonGrid ref={barRef} isCompact={isCompact}>
      <ReplayPlayPauseBar />
      <Container>
        <TimeAndScrubberGrid isCompact={isCompact} showZoom />
      </Container>
      <ButtonBar gap={1}>
        <ReplayOptionsMenu
          speedOptions={speedOptions}
          hideFastForward={hideFastForward}
        />
        <ReplayFullscreenButton toggleFullscreen={toggleFullscreen} />
      </ButtonBar>
    </ButtonGrid>
  );
}

const ButtonGrid = styled('div')<{isCompact: boolean}>`
  display: flex;
  gap: 0 ${space(2)};
  flex-direction: row;
  justify-content: space-between;
  ${p => (p.isCompact ? `flex-wrap: wrap;` : '')}
`;

const Container = styled('div')`
  display: flex;
  flex-direction: column;
  flex: 1 1;
  justify-content: center;
`;

export default ReplayControls;
