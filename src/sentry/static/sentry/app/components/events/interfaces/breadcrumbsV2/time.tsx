import React from 'react';
import styled from '@emotion/styled';
import moment from 'moment';

import {t, tn} from 'app/locale';
import {defined} from 'app/utils';
import Tooltip from 'app/components/tooltip';
import getDynamicText from 'app/utils/getDynamicText';
import TextOverflow from 'app/components/textOverflow';
import {use24Hours} from 'app/utils/dates';

const timeFormat = 'HH:mm:ss';
const timeDateFormat = `ll ${timeFormat}`;

const fromOrNow = (
  parsedTime: ReturnType<typeof moment>,
  parsedTimeToCompareWith: ReturnType<typeof moment>
) => {
  // ll is necessary here, otherwise moment(x).from will throw an error
  const formattedTime = moment(parsedTime.format(timeDateFormat));
  const formattedTimeToCompareWith = parsedTimeToCompareWith.format(timeDateFormat);
  const timeDiff = Math.abs(formattedTime.diff(formattedTimeToCompareWith));

  if (timeDiff > 60000) {
    return formattedTime.from(formattedTimeToCompareWith);
  }

  if (timeDiff > 0) {
    return tn('%s second ago', '%s seconds ago', timeDiff / 1000);
  }

  return t('Now');
};

const getAbsoluteTimeFormat = (format: string) => {
  if (use24Hours()) {
    return format;
  }

  return `${format} A`;
};

const gerFormattedTimestamp = (
  timestamp: string,
  relativeTimestamp: string,
  displayRelativeTime?: boolean
) => {
  const parsedTimestamp = moment(timestamp);
  const date = parsedTimestamp.format('ll');

  const displayMilliSeconds = defined(parsedTimestamp.milliseconds());
  const relativeTime = fromOrNow(parsedTimestamp, moment(relativeTimestamp));

  if (!displayRelativeTime) {
    return {
      date: `${date} ${parsedTimestamp.format(getAbsoluteTimeFormat('HH:mm'))}`,
      time: relativeTime,
      displayTime: parsedTimestamp.format(timeFormat),
    };
  }

  return {
    date,
    time: parsedTimestamp.format(
      getAbsoluteTimeFormat(displayMilliSeconds ? `${timeFormat}.SSS` : timeFormat)
    ),
    displayTime: relativeTime,
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

  const {date, time, displayTime} = gerFormattedTimestamp(
    timestamp,
    relativeTime,
    displayRelativeTime
  );

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
            value: displayTime,
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
