import {getDuration} from '@sentry/scraps/duration';

import {getExactDuration} from 'sentry/utils/duration/getExactDuration';

interface Props extends React.HTMLAttributes<HTMLSpanElement> {
  seconds: number;
  abbreviation?: boolean;
  exact?: boolean;
  fixedDigits?: number;
}

export function Duration({seconds, fixedDigits, abbreviation, exact, ...props}: Props) {
  return (
    <span {...props}>
      {exact
        ? getExactDuration(seconds, abbreviation)
        : getDuration(seconds, {
            precision: fixedDigits,
            style: abbreviation ? 'short' : 'regular',
          })}
    </span>
  );
}
