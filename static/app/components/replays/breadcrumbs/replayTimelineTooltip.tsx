import {useRef} from 'react';
import {createPortal} from 'react-dom';
import styled from '@emotion/styled';

import {Overlay} from 'sentry/components/overlay';
import {space} from 'sentry/styles/space';
import {getFormattedDate, shouldUse24Hours} from 'sentry/utils/dates';
import formatDuration from 'sentry/utils/duration/formatDuration';
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

  const labelText =
    timestampType === 'absolute'
      ? getFormattedDate(
          startTimestamp + (currentHoverTime ?? 0),
          shouldUse24Hours() ? 'HH:mm:ss.SSS' : 'hh:mm:ss.SSS',
          {local: true}
        )
      : formatDuration({
          duration: [currentHoverTime ?? 0, 'ms'],
          precision: 'ms',
          style: 'hh:mm:ss.sss',
        });

  // useEffect(() => {
  //   const handleMouseMove = () => {
  //     const percent = ((currentHoverTime ?? 0) / durationMs) * 100;
  //     if (labelRef.current) {
  //       labelRef.current.style.left = `${percent}%`;
  //     }
  //   };

  //   container?.addEventListener('mousemove', handleMouseMove);
  //   return () => container?.removeEventListener('mousemove', handleMouseMove);
  // }, [container, currentHoverTime, durationMs]);

  const percent = ((currentHoverTime ?? 0) / durationMs) * 100;

  return createPortal(
    <CursorLabel
      ref={labelRef}
      style={{
        display: currentHoverTime ? 'block' : 'none',
        top: 0,
        left: `${percent}%`,
      }}
    >
      {labelText}
    </CursorLabel>,
    container
  );
}

const CursorLabel = styled(Overlay)`
  position: absolute;
  translate: 10px -8px;
  font-variant-numeric: tabular-nums;
  width: max-content;
  padding: ${space(0.75)} ${space(1)};
  line-height: 1.2;
  pointer-events: none; /* Prevent tooltip from blocking mouse events */
`;
