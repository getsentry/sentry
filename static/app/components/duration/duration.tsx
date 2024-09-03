import type {HTMLAttributes} from 'react';
import styled from '@emotion/styled';

import formatDuration from 'sentry/utils/duration/formatDuration';
import type {Duration as TDuration, Unit} from 'sentry/utils/duration/types';

interface Props extends HTMLAttributes<HTMLTimeElement> {
  /**
   * The Duration that you want to render
   */
  duration: TDuration;

  /**
   * How granular to render the value. You can pass in something that has `ms`
   * precision but only show the total number of seconds (à la Math.floor)
   */
  precision: Unit;
}

const Duration = styled(({duration, precision, ...props}: Props) => {
  // Style and precision should match, otherwise style will pad out missing or
  // truncated values which we don't want in this component.
  const style = precision === 'ms' ? 'hh:mm:ss.sss' : 'hh:mm:ss';

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

export default Duration;
