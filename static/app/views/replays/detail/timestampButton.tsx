import styled from '@emotion/styled';

import DateTime from 'sentry/components/dateTime';
import {showPlayerTime} from 'sentry/components/replays/utils';
import Tooltip from 'sentry/components/tooltip';
import {IconPlay} from 'sentry/icons';
import space from 'sentry/styles/space';

type TimestampButtonProps = {
  onClick: () => void;
  startTimestampMs: number;
  timestampMs: string | number | Date;
};
function TimestampButton({onClick, startTimestampMs, timestampMs}: TimestampButtonProps) {
  return (
    <Tooltip title={<DateTime date={timestampMs} />}>
      <StyledButton onClick={onClick}>
        <IconPlay size="xs" />
        {showPlayerTime(timestampMs, startTimestampMs)}
      </StyledButton>
    </Tooltip>
  );
}

const StyledButton = styled('button')`
  background: none;
  border: none;
  color: ${p => p.theme.subText};
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
