import React from 'react';
import styled from '@emotion/styled';

import showPlayerTime from './utils';

type Props = {
  relativeTime: number;
  timestamp: string | undefined;
};

const PlayerRelativeTime = ({relativeTime, timestamp}: Props) => {
  if (!timestamp) {
    return <div />;
  }

  return (
    <React.Fragment>
      <Value>{showPlayerTime(timestamp, relativeTime)}</Value>
    </React.Fragment>
  );
};

const Value = styled('p')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: normal;
`;

export default PlayerRelativeTime;
