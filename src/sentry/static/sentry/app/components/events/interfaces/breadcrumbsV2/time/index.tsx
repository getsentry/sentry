import React from 'react';
import styled from '@emotion/styled';

import Highlight from 'app/components/highlight';
import {defined} from 'app/utils';
import Tooltip from 'app/components/tooltip';
import getDynamicText from 'app/utils/getDynamicText';
import TextOverflow from 'app/components/textOverflow';

import {getFormattedTimestamp} from './utils';

type Props = {
  searchTerm: string;
  timestamp?: string;
  relativeTime?: string;
  displayRelativeTime?: boolean;
};

const Time = React.memo(
  ({timestamp, relativeTime, displayRelativeTime, searchTerm}: Props) => {
    if (!(defined(timestamp) && defined(relativeTime))) {
      return null;
    }

    const {date, time, displayTime} = getFormattedTimestamp(
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
              {time !== '\u2014' && <div>{time}</div>}
            </div>
          }
          containerDisplayMode="inline-flex"
          disableForVisualTest
        >
          <TextOverflow>
            {getDynamicText({
              value: <Highlight text={searchTerm}>{displayTime}</Highlight>,
              fixed: '00:00:00',
            })}
          </TextOverflow>
        </Tooltip>
      </Wrapper>
    );
  }
);

export default Time;

const Wrapper = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray700};
`;
