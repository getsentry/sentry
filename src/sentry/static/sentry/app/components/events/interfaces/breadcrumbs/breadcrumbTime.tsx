import React from 'react';
import styled from '@emotion/styled';
import moment from 'moment';

import {defined} from 'app/utils';
import Tooltip from 'app/components/tooltip';
import getDynamicText from 'app/utils/getDynamicText';

const getBreadcrumbTimeTooltipTitle = (timestamp: string) => {
  const parsedTimestamp = moment(timestamp);
  const timestampFormat = parsedTimestamp.milliseconds() ? 'll H:mm:ss.SSS A' : 'lll';
  return parsedTimestamp.format(timestampFormat);
};

type Props = {
  timestamp?: string;
};

const BreadcrumbTime = ({timestamp}: Props) =>
  defined(timestamp) ? (
    <Tooltip title={getBreadcrumbTimeTooltipTitle(timestamp)} disableForVisualTest>
      <Time>
        {getDynamicText({
          value: moment(timestamp).format('HH:mm:ss'),
          fixed: '00:00:00',
        })}
      </Time>
    </Tooltip>
  ) : null;

export default BreadcrumbTime;

const Time = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray700};
`;
