import {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import styled from '@emotion/styled';

import {Text} from 'sentry/components/core/text';
import {Overlay} from 'sentry/components/overlay';
import {space} from 'sentry/styles/space';
import {getFormattedDate, shouldUse24Hours} from 'sentry/utils/dates';
import formatDuration from 'sentry/utils/duration/formatDuration';
import toPercent from 'sentry/utils/number/toPercent';
import {useReplayPrefs} from 'sentry/utils/replays/playback/providers/replayPreferencesContext';
import {useReplayReader} from 'sentry/utils/replays/playback/providers/replayReaderProvider';
import useCurrentHoverTime from 'sentry/utils/replays/playback/providers/useCurrentHoverTime';

type Props = {
  container: HTMLElement;
};

export default function TimelineTooltip({container}: Props) {
  const replay = useReplayReader();
  const [prefs] = useReplayPrefs();
  const timestampType = prefs.timestampType;

  const labelRef = useRef<HTMLDivElement | null>(null);

  const durationMs = replay?.getDurationMs() ?? 0;
  const startTimestamp = replay?.getStartTimestampMs() ?? 0;
  const [currentHoverTime] = useCurrentHoverTime();

  // Use a timeout instead of hiding right away, to avoid flickering.
  const [lastHoverTime, setLastHoverTime] = useState<number | undefined>(undefined);
  useEffect(() => {
    if (currentHoverTime === undefined) {
      const timeout = setTimeout(() => {
        setLastHoverTime(undefined);
      }, 0);
      return () => clearTimeout(timeout);
    }
    setLastHoverTime(currentHoverTime);
    return () => {};
  }, [currentHoverTime]);

  return createPortal(
    <CursorLabel
      ref={labelRef}
      style={{
        display: lastHoverTime ? 'block' : 'none',
        top: 0,
        left: toPercent((lastHoverTime ?? 0) / durationMs),
      }}
    >
      <Text size="sm" tabular style={{fontWeight: 'normal'}}>
        {timestampType === 'absolute'
          ? getFormattedDate(
              startTimestamp + (lastHoverTime ?? 0),
              shouldUse24Hours() ? 'HH:mm:ss.SSS' : 'hh:mm:ss.SSS',
              {local: true}
            )
          : formatDuration({
              duration: [lastHoverTime ?? 0, 'ms'],
              precision: 'ms',
              style: 'hh:mm:ss.sss',
            })}
      </Text>
    </CursorLabel>,
    container
  );
}

const CursorLabel = styled(Overlay)`
  position: absolute;
  translate: 10px -10px;
  padding: ${space(0.75)} ${space(1)};
`;
