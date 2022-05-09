import styled from '@emotion/styled';

import Tooltip from 'sentry/components/tooltip';

import {getDateFormatted, showPlayerTime} from './utils';

type Props = {
  relativeTime: number | undefined;
  timestamp: string | undefined;
};

const PlayerRelativeTime = ({relativeTime, timestamp}: Props) => {
  if (!timestamp || !relativeTime) {
    return <div />;
  }

  return (
    <Wrapper>
      <Tooltip
        title={getDateFormatted(timestamp)}
        disabled={!timestamp}
        skipWrapper
        disableForVisualTest
        underlineColor="gray300"
        showUnderline
      >
        <Value>{showPlayerTime(timestamp, relativeTime)}</Value>
      </Tooltip>
    </Wrapper>
  );
};

const Wrapper = styled('div')`
  display: flex;
  justify-content: center;
  position: relative;
  :before {
    content: '';
    display: block;
    width: 1px;
    top: 0;
    bottom: 0;
    left: 50%;
    transform: translate(-50%);
    position: absolute;
  }
`;

const Value = styled('p')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: normal;
`;

export default PlayerRelativeTime;
