import React from 'react';
import styled from '@emotion/styled';
import moment from 'moment';

import {t} from 'app/locale';
import {defined} from 'app/utils';
import Tooltip from 'app/components/tooltip';
import getDynamicText from 'app/utils/getDynamicText';
import TextOverflow from 'app/components/textOverflow';

const fromOrNow = (time: string, timeToCompareWith: string) => {
  if (
    !(
      moment(time).format('HH:mm:ss') === moment(timeToCompareWith).format('HH:mm:ss') &&
      // compares if it happened less than 1 m ago (60000 equals 1m)
      Math.abs(moment(time).diff(timeToCompareWith)) < 60000
    )
  ) {
    return moment(time).from(timeToCompareWith);
  }

  return t('Now');
};

const getTooltipTitle = (
  timestamp: string,
  relativeTime: string,
  displayRelativeTime?: boolean
) => {
  const parsedTimestamp = moment(timestamp);
  const date = parsedTimestamp.format('ll');

  if (!displayRelativeTime) {
    // ll is necessary here, otherwise moment(x).from will throw an error
    const formattedTimestamp = parsedTimestamp.format('ll H:mm:ss');
    const formattedRelativeTime = moment(relativeTime).format('ll H:mm:ss');
    const time = fromOrNow(formattedTimestamp, formattedRelativeTime);
    return {date, time};
  }

  return {
    date,
    time: parsedTimestamp.format(
      parsedTimestamp.milliseconds() ? 'H:mm:ss.SSS A' : 'H:mm:ss A'
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
