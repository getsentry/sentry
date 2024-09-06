import type {MouseEvent} from 'react';
import styled from '@emotion/styled';

import {DateTime} from 'sentry/components/dateTime';
import Duration from 'sentry/components/duration/duration';
import {Tooltip} from 'sentry/components/tooltip';
import {IconPlay} from 'sentry/icons';
import {space} from 'sentry/styles/space';

type Props = {
  startTimestampMs: number;
  timestampMs: string | number | Date;
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
  return (
    <Tooltip title={<DateTime seconds date={timestampMs} />} skipWrapper>
      <StyledButton
        as={onClick ? 'button' : 'span'}
        onClick={onClick}
        className={className}
      >
        <IconPlay size="xs" />
        <Duration
          duration={[Math.abs(new Date(timestampMs).getTime() - startTimestampMs), 'ms']}
          precision={precision}
        />
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
