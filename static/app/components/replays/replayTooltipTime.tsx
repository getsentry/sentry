import {Fragment} from 'react';
import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import {getFormat, getFormattedDate} from 'sentry/utils/dates';
import formatDuration from 'sentry/utils/duration/formatDuration';

interface Props {
  startTimestampMs: number;
  timestampMs: number;
}

export default function ReplayTooltipTime({startTimestampMs, timestampMs}: Props) {
  return (
    <Fragment>
      <TooltipTime>
        {t(
          'Date: %s',
          getFormattedDate(
            timestampMs,
            `${getFormat({year: true, seconds: true, timeZone: true})}`,
            {
              local: true,
            }
          )
        )}
      </TooltipTime>
      <TooltipTime>
        {t(
          'Time within replay: %s',
          formatDuration({
            duration: [Math.abs(timestampMs - startTimestampMs), 'ms'],
            precision: 'ms',
            style: 'hh:mm:ss.sss',
          })
        )}
      </TooltipTime>
    </Fragment>
  );
}

const TooltipTime = styled('div')`
  text-align: left;
`;
