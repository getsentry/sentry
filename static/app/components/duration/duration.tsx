import type {HTMLAttributes} from 'react';
import styled from '@emotion/styled';

import {formatDuration} from 'sentry/utils/duration/formatDuration';
import type {Duration as TDuration, Unit} from 'sentry/utils/duration/types';

const DURATION_MS_FORMAT = 'hh:mm:ss.sss';
const DURATION_FORMAT = 'hh:mm:ss';

interface Props extends HTMLAttributes<HTMLTimeElement> {
  /**
   * The Duration that you want to render
   */
  duration: TDuration;

  /**
   * How granular to render the value. For example you can pass in something
   * that has `ms` precision but only show the total number of seconds.
   */
  precision: Unit;
}

export const Duration = styled(({duration, precision, ...props}: Props) => {
  // Style and precision should match, otherwise style will pad out missing or
  // truncated values which we don't want in this component.
  const style = precision === 'ms' ? DURATION_MS_FORMAT : DURATION_FORMAT;

  return (
    <time
      dateTime={formatDuration({duration, precision: 'ms', style: 'ISO8601'})}
      title={formatDuration({duration, precision: 'ms', style: 'hh:mm:ss.sss'})}
      {...props}
    >
      {formatDuration({duration, precision, style})}
    </time>
  );
})`
  font-variant-numeric: tabular-nums;
`;
