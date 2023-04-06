import {MouseEvent} from 'react';
import styled from '@emotion/styled';

import DateTime from 'sentry/components/dateTime';
import {showPlayerTime} from 'sentry/components/replays/utils';
import {Tooltip} from 'sentry/components/tooltip';
import {IconPlay} from 'sentry/icons';
import {space} from 'sentry/styles/space';

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
    <Tooltip title={<DateTime date={timestampMs} />}>
      <StyledButton
        as={onClick ? 'button' : 'span'}
        onClick={onClick}
        className={className}
      >
        <IconPlay size="xs" />
        {showPlayerTime(timestampMs, startTimestampMs, format === 'mm:ss.SSS')}
      </StyledButton>
    </Tooltip>
  );
}

const StyledButton = styled('button')`
  background: transparent;
  border: none;
  color: inherit;
  font-size: ${p => p.theme.fontSizeSmall};
  font-variant-numeric: tabular-nums;

  display: flex;
  align-items: center;
  gap: ${space(0.25)};
  padding: 0;
`;

export default TimestampButton;
