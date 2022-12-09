import styled from '@emotion/styled';

import DateTime from 'sentry/components/dateTime';
import {showPlayerTime} from 'sentry/components/replays/utils';
import Tooltip from 'sentry/components/tooltip';
import {IconPlay} from 'sentry/icons';
import space from 'sentry/styles/space';

type Props = {
  format: 'mm:ss' | 'mm:ss.SSS';
  onClick: () => void;
  startTimestampMs: number;
  timestampMs: string | number | Date;
  className?: string;
};

function TimestampButton({
  className,
  format,
  onClick,
  startTimestampMs,
  timestampMs,
}: Props) {
  return (
    <Tooltip title={<DateTime date={timestampMs} />}>
      <StyledButton onClick={onClick} className={className}>
        <IconPlay size="xs" />
        {showPlayerTime(timestampMs, startTimestampMs, format === 'mm:ss.SSS')}
      </StyledButton>
    </Tooltip>
  );
}

const StyledButton = styled('button')`
  background: transparent;
  border: none;
  color: 'inherit';
  font-size: ${p => p.theme.fontSizeSmall};
  font-variant-numeric: tabular-nums;

  display: flex;
  align-items: center;
  gap: ${space(0.25)};
  padding: 0;

  & > svg {
    visibility: hidden;
  }
  &:hover svg {
    visibility: visible;
  }
`;

export default TimestampButton;
