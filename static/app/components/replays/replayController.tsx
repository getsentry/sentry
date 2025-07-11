import {useCallback, useLayoutEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {useResizeObserver} from '@react-aria/utils';

import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {DateTime} from 'sentry/components/dateTime';
import Duration from 'sentry/components/duration/duration';
import ReplayCurrentTime from 'sentry/components/replays/player/replayCurrentTime';
import ReplayPreferenceDropdown from 'sentry/components/replays/preferences/replayPreferenceDropdown';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {ReplayFullscreenButton} from 'sentry/components/replays/replayFullscreenButton';
import ReplayPlayPauseButton from 'sentry/components/replays/replayPlayPauseButton';
import TimeAndScrubberGrid from 'sentry/components/replays/timeAndScrubberGrid';
import {IconNext, IconRewind10} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import divide from 'sentry/utils/number/divide';
import toPercent from 'sentry/utils/number/toPercent';
import {getNextReplayFrame} from 'sentry/utils/replays/getReplayEvent';
import {useReplayPrefs} from 'sentry/utils/replays/playback/providers/replayPreferencesContext';
import useCurrentHoverTime from 'sentry/utils/replays/playback/providers/useCurrentHoverTime';

const SECOND = 1000;

const COMPACT_WIDTH_BREAKPOINT = 500;

interface Props {
  toggleFullscreen: () => void;
  hideFastForward?: boolean;
  isLoading?: boolean;
  speedOptions?: number[];
}

function ReplayPlayPauseBar({isLoading}: {isLoading?: boolean}) {
  const {currentTime, replay, setCurrentTime} = useReplayContext();

  return (
    <ButtonBar>
      <Button
        size="sm"
        title={t('Rewind 10s')}
        icon={<IconRewind10 size="sm" />}
        onClick={() => setCurrentTime(currentTime - 10 * SECOND)}
        aria-label={t('Rewind 10 seconds')}
        disabled={isLoading}
      />
      <ReplayPlayPauseButton isLoading={isLoading} />
      <Button
        disabled={isLoading}
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

export default function ReplayController({
  toggleFullscreen,
  hideFastForward = false,
  speedOptions = [0.1, 0.25, 0.5, 1, 2, 4, 8, 16],
  isLoading,
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
      <StartTimestamp />
      <CurrentTimestamp />
      <EndTimestamp />
      <ReplayPlayPauseBar isLoading={isLoading} />
      <Container>
        <TimeAndScrubberGrid isCompact={isCompact} showZoom isLoading={isLoading} />
      </Container>
      <ButtonBar>
        <ReplayPreferenceDropdown
          isLoading={isLoading}
          speedOptions={speedOptions}
          hideFastForward={hideFastForward}
        />
        <ReplayFullscreenButton toggleFullscreen={toggleFullscreen} />
      </ButtonBar>
    </ButtonGrid>
  );
}

function CurrentTimestamp() {
  const {replay, currentTime} = useReplayContext();
  const [currentHoverTime] = useCurrentHoverTime();

  const startTimestamp = replay?.getStartTimestampMs() ?? 0;
  const durationMs = replay?.getDurationMs() ?? 0;
  const percentComplete = divide(currentTime, durationMs);
  const hoverPlace = divide(currentHoverTime || 0, durationMs);
  const initialTranslate = 0;

  const starting = percentComplete < initialTranslate;
  const ending = percentComplete + initialTranslate > 1;

  const translate = () => {
    if (starting) {
      return 0;
    }
    if (ending) {
      return 1 - 2 * initialTranslate;
    }
    return currentTime > durationMs ? 1 : percentComplete - initialTranslate;
  };
  const left = toPercent(translate());

  return (
    <StyledScrubber style={{transform: `translateX(${left})`}}>
      <CurrentNumeric>
        <ReplayCurrentTime />
      </CurrentNumeric>
    </StyledScrubber>
  );
}

function StartTimestamp() {
  const {replay} = useReplayContext();
  const [prefs] = useReplayPrefs();
  const startTimestamp = replay?.getStartTimestampMs() ?? 0;
  const timestampType = prefs.timestampType;

  return (
    <StartNumeric>
      {timestampType === 'absolute' ? (
        <DateTime timeOnly seconds date={startTimestamp} />
      ) : (
        <Duration duration={[0, 'ms']} precision="sec" />
      )}
    </StartNumeric>
  );
}

function EndTimestamp() {
  const {replay} = useReplayContext();
  const [prefs] = useReplayPrefs();
  const durationMs = replay?.getDurationMs();
  const startTimestamp = replay?.getStartTimestampMs() ?? 0;
  const timestampType = prefs.timestampType;

  return (
    <EndNumeric>
      {durationMs === undefined ? (
        '--:--'
      ) : timestampType === 'absolute' ? (
        <DateTime timeOnly seconds date={startTimestamp + durationMs} />
      ) : (
        <Duration duration={[durationMs, 'ms']} precision="sec" />
      )}
    </EndNumeric>
  );
}

const ButtonGrid = styled('div')<{isCompact: boolean}>`
  display: grid;
  grid-template-columns: auto 1fr auto;
  grid-template-rows: 1fr auto;
  gap: 0 ${space(2)};
  justify-content: space-between;
  ${p => (p.isCompact ? `flex-wrap: wrap;` : '')}
`;

const Container = styled('div')`
  display: flex;
  flex-direction: column;
  flex: 1 1;
  justify-content: center;
`;

const Numeric = styled('span')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSize.sm};
  font-variant-numeric: tabular-nums;
  font-weight: ${p => p.theme.fontWeight.bold};
  align-self: self-end;
`;
const CurrentNumeric = styled(Numeric)`
  position: absolute;
  bottom: 0;
`;

const StartNumeric = styled(Numeric)`
  justify-self: end;
  margin-right: -${space(2)};
  margin-top: ${space(1)};
`;

const EndNumeric = styled(Numeric)`
  justify-self: start;
  margin-left: -${space(2)};
  margin-top: ${space(1)};
`;

const StyledScrubber = styled('div')`
  position: relative;
`;
