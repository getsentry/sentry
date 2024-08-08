import type {MouseEvent} from 'react';
import styled from '@emotion/styled';

import {DateTime} from 'sentry/components/dateTime';
import {Tooltip} from 'sentry/components/tooltip';
import {IconPlay} from 'sentry/icons';
import formatReplayDuration from 'sentry/utils/duration/formatReplayDuration';

type Props = {
  startTimestampMs: number;
  timestampMs: string | number | Date;
  className?: string;
  format?: 'mm:ss' | 'mm:ss.SSS';
  onClick?: (event: MouseEvent) => void;
};

function TimestampButton({
  className,
  format = 'mm:ss',
  onClick,
  startTimestampMs,
  timestampMs,
}: Props) {
  return (
    <Tooltip title={<DateTime seconds date={timestampMs} />} skipWrapper>
      <StyledButton
        as={onClick ? 'button' : 'span'}
        onClick={onClick}
        className={className}
      >
        <IconPlay size="xs" />
        {formatReplayDuration(
          Math.abs(new Date(timestampMs).getTime() - startTimestampMs),
          format === 'mm:ss.SSS'
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
  gap: ${p => p.theme.space(0.25)};
  padding: 0;
  height: 100%;
`;

export default TimestampButton;
