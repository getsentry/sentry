import styled from '@emotion/styled';

import DateTime from 'sentry/components/dateTime';
import {showPlayerTime} from 'sentry/components/replays/utils';
import {Tooltip} from 'sentry/components/tooltip';

type Props = {
  relativeTimeMs: number | undefined;
  timestamp: string | undefined;
};

function PlayerRelativeTime({relativeTimeMs, timestamp}: Props) {
  if (!timestamp || !relativeTimeMs) {
    return <div />;
  }

  return (
    <Tooltip
      title={<DateTime date={timestamp} seconds />}
      disabled={!timestamp}
      skipWrapper
      disableForVisualTest
      underlineColor="gray300"
      showUnderline
    >
      <Value>{showPlayerTime(timestamp, relativeTimeMs)}</Value>
    </Tooltip>
  );
}

const Value = styled('p')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
  font-variant-numeric: tabular-nums;
  margin-bottom: 0;
`;

export default PlayerRelativeTime;
