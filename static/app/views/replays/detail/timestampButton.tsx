import type {MouseEvent} from 'react';
import styled from '@emotion/styled';

import {DateTime} from 'sentry/components/dateTime';
import Duration from 'sentry/components/duration/duration';
import ReplayTooltipTime from 'sentry/components/replays/replayTooltipTime';
import {Tooltip} from 'sentry/components/tooltip';
import {IconPlay} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import {useReplayPrefs} from 'sentry/utils/replays/playback/providers/replayPreferencesContext';

type Props = {
  startTimestampMs: number;
  timestampMs: number;
  className?: string;
  onClick?: (event: MouseEvent) => void;
  precision?: 'sec' | 'ms';
};

export default function TimestampButton({
  className,
  precision = 'sec',
  onClick,
  startTimestampMs,
  timestampMs,
}: Props) {
  const [prefs] = useReplayPrefs();
  const timestampType = prefs.timestampType;
  return (
    <Tooltip
      title={
        <div>
          <ReplayTooltipTime
            timestampMs={timestampMs}
            startTimestampMs={startTimestampMs}
          />
        </div>
      }
      skipWrapper
    >
      <StyledButton
        as={onClick ? 'button' : 'span'}
        onClick={onClick}
        className={className}
      >
        <IconPlay size="xs" />
        {timestampType === 'absolute' ? (
          <DateTime timeOnly seconds date={timestampMs} />
        ) : (
          <Duration
            duration={[Math.abs(timestampMs - startTimestampMs), 'ms']}
            precision={precision}
          />
        )}
      </StyledButton>
    </Tooltip>
  );
}

const StyledButton = styled('button')`
  background: transparent;
  border: none;
  color: inherit;
  font-variant-numeric: tabular-nums;
  line-height: 1.2em;

  display: flex;
  align-items: flex-start;
  align-self: baseline;
  gap: ${space(0.25)};
  padding: 0;
  height: 100%;
`;
