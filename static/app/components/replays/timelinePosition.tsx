import React from 'react';
import styled from '@emotion/styled';

import * as Progress from 'sentry/components/replays/progress';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {divide} from 'sentry/components/replays/utils';
import space from 'sentry/styles/space';

type Props = {};

function TimelinePosition({}: Props) {
  const {currentTime, duration} = useReplayContext();

  const percentComplete = divide(currentTime, duration);

  return (
    <Progress.Meter>
      <Value percent={percentComplete} />
    </Progress.Meter>
  );
}

const Value = styled(Progress.Value)`
  border-right: ${space(0.25)} solid ${p => p.theme.purple300};
`;

export default TimelinePosition;
