import styled from '@emotion/styled';

import DateTime from 'sentry/components/dateTime';
import Tooltip from 'sentry/components/tooltip';

import {showPlayerTime} from './utils';

type Props = {
  relativeTime: number | undefined;
  timestamp: string | undefined;
};

const PlayerRelativeTime = ({relativeTime, timestamp}: Props) => {
  if (!timestamp || !relativeTime) {
    return <div />;
  }

  return (
    <Tooltip
      title={<DateTime date={timestamp} />}
      disabled={!timestamp}
      skipWrapper
      disableForVisualTest
      underlineColor="gray300"
      showUnderline
    >
      <Value>{showPlayerTime(timestamp, relativeTime)}</Value>
    </Tooltip>
  );
};

const Value = styled('p')`
  color: ${p => p.theme.subText};
  font-size: 0.7em;
  font-family: ${p => p.theme.text.familyMono};
`;

export default PlayerRelativeTime;
