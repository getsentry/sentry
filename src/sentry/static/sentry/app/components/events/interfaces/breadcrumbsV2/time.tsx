import React from 'react';
import styled from '@emotion/styled';
import moment from 'moment';

import {defined} from 'app/utils';
import Tooltip from 'app/components/tooltip';
import getDynamicText from 'app/utils/getDynamicText';
import overflowEllipsis from 'app/styles/overflowEllipsis';

const getBreadcrumbTimeTooltipTitle = (timestamp: string) => {
  const parsedTimestamp = moment(timestamp);
  const timestampFormat = parsedTimestamp.milliseconds() ? 'll H:mm:ss.SSS A' : 'lll';
  return parsedTimestamp.format(timestampFormat);
};

type Props = {
  timestamp?: string;
};

const Time = ({timestamp}: Props) =>
  defined(timestamp) ? (
    <Tooltip title={getBreadcrumbTimeTooltipTitle(timestamp)}>
      <Wrapper>
        {getDynamicText({
          value: moment(timestamp).format('HH:mm:ss'),
          fixed: '00:00:00',
        })}
      </Wrapper>
    </Tooltip>
  ) : null;

export {Time};

const Wrapper = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray4};
  ${overflowEllipsis};
`;
