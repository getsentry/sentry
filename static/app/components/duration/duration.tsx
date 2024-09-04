import {css} from '@emotion/react';

import formatDuration from 'sentry/utils/duration/formatDuration';
import type {Duration as TDuration} from 'sentry/utils/duration/types';

export default function Duration({duration}: {duration: TDuration}) {
  return (
    <time
      css={css`
        font-variant-numeric: tabular-nums;
      `}
      dateTime={formatDuration({duration, precision: 'ms', style: 'HTML duration'})}
      title={formatDuration({duration, precision: 'ms', style: 'hh:mm:ss.sss'})}
    >
      {formatDuration({duration, precision: 'sec', style: 'h:mm:ss'})}
    </time>
  );
}
