import getDuration from 'sentry/utils/duration/getDuration';
import {getExactDuration} from 'sentry/utils/duration/getExactDuration';

interface Props extends React.HTMLAttributes<HTMLSpanElement> {
  seconds: number;
  abbreviation?: boolean;
  exact?: boolean;
  fixedDigits?: number;
  precision?: 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'years';
}

function Duration({
  seconds,
  fixedDigits,
  abbreviation,
  exact,
  precision,
  ...props
}: Props) {
  return (
    <span {...props}>
      {exact
        ? getExactDuration(seconds, abbreviation, precision)
        : getDuration(seconds, fixedDigits, abbreviation)}
    </span>
  );
}

export default Duration;
