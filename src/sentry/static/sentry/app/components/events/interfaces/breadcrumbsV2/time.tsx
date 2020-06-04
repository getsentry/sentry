import React from 'react';
import styled from '@emotion/styled';
import moment from 'moment';

import {defined} from 'app/utils';
import Tooltip from 'app/components/tooltip';
import getDynamicText from 'app/utils/getDynamicText';
import TextOverflow from 'app/components/textOverflow';

const getTooltipTitle = (
  timestamp: string,
  relativeTime: string,
  displayRelativeTime?: boolean
) => {
  const parsedTimestamp = moment(timestamp);
  const date = parsedTimestamp.format('ll');

  if (!displayRelativeTime) {
    return {date, time: parsedTimestamp.from(relativeTime)};
  }

  return {
    date,
    time: parsedTimestamp.format(
      parsedTimestamp.milliseconds() ? 'H:mm:ss.SSS A' : 'lll'
    ),
  };
};

type Props = {
  timestamp?: string;
  relativeTime?: string;
  displayRelativeTime?: boolean;
};

const Time = React.memo(({timestamp, relativeTime, displayRelativeTime}: Props) => {
  if (!(defined(timestamp) && defined(relativeTime))) {
    return null;
  }

  const {date, time} = getTooltipTitle(timestamp, relativeTime, displayRelativeTime);

  return (
    <Wrapper>
      <Tooltip
        title={
          <div>
            <div>{date}</div>
            <div>{time}</div>
          </div>
        }
        containerDisplayMode="inline-flex"
      >
        <TextOverflow>
          {getDynamicText({
            value: displayRelativeTime
              ? moment(timestamp).from(relativeTime)
              : moment(timestamp).format('HH:mm:ss'),
            fixed: '00:00:00',
          })}
        </TextOverflow>
      </Tooltip>
    </Wrapper>
  );
});

export default Time;

const Wrapper = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray700};
`;
