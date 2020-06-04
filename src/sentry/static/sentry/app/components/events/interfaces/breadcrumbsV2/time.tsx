import React from 'react';
import styled from '@emotion/styled';
import moment from 'moment';

import {defined} from 'app/utils';
import Tooltip from 'app/components/tooltip';
import getDynamicText from 'app/utils/getDynamicText';
import TextOverflow from 'app/components/textOverflow';

const getTooltipTitle = (timestamp: string, isRelative: boolean) => {
  const parsedTimestamp = moment(timestamp);
  const timestampFormat = parsedTimestamp.milliseconds() ? 'll H:mm:ss.SSS A' : 'lll';
  return parsedTimestamp.format(timestampFormat);
};

type Props = {
  isRelative: boolean;
  timestamp?: string;
};

const Time = React.memo(({timestamp, isRelative}: Props) =>
  defined(timestamp) ? (
    <Wrapper>
      <Tooltip
        title={getTooltipTitle(timestamp, isRelative)}
        containerDisplayMode="inline-flex"
      >
        <TextOverflow>
          {getDynamicText({
            value: isRelative
              ? moment(timestamp).fromNow()
              : moment(timestamp).format('HH:mm:ss'),
            fixed: '00:00:00',
          })}
        </TextOverflow>
      </Tooltip>
    </Wrapper>
  ) : null
);

export default Time;

const Wrapper = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray700};
`;
