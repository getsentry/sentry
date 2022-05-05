import React from 'react';
import styled from '@emotion/styled';

import showPlayerTime from './utils';

type Props = {
  relativeTime: number | undefined;
  timestamp: string | undefined;
};

const PlayerRelativeTime = ({relativeTime, timestamp}: Props) => {
  if (!timestamp || !relativeTime) {
    return <div />;
  }

  return <Value>{showPlayerTime(timestamp, relativeTime)}</Value>;
};

const Value = styled('p')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: normal;
`;

export default PlayerRelativeTime;
