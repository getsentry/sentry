import {Fragment} from 'react';
import styled from '@emotion/styled';

import {DateTime} from 'sentry/components/dateTime';
import {t, tct} from 'sentry/locale';
import formatDuration from 'sentry/utils/duration/formatDuration';

interface Props {
  startTimestampMs: number;
  timestampMs: number;
}

export default function ReplayTooltipTime({startTimestampMs, timestampMs}: Props) {
  return (
    <Fragment>
      <TooltipTime>
        {tct('Date: [date]', {
          date: <DateTime date={timestampMs} year seconds timeZone />,
        })}
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
