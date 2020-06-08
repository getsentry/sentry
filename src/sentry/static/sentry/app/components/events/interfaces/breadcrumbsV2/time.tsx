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

const getAbsoluteTimeFormat = (displayMilliSeconds: boolean) => {
  const defaultFormat = displayMilliSeconds ? `${timeFormat}.SSS` : timeFormat;

  if (use24Hours()) {
    return defaultFormat;
  }

  return `${defaultFormat} A`;
};

const getTooltipTitle = (
  timestamp: string,
  relativeTime: string,
  displayRelativeTime?: boolean
) => {
  const parsedTimestamp = moment(timestamp);
  const date = parsedTimestamp.format('ll');

  if (!displayRelativeTime) {
    const time = fromOrNow(parsedTimestamp, moment(relativeTime));
    return {date, time};
  }

  const displayMilliSeconds = defined(parsedTimestamp.milliseconds());

  return {
    date,
    time: parsedTimestamp.format(getAbsoluteTimeFormat(displayMilliSeconds)),
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
