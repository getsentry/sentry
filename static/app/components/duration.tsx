import {getDuration} from 'sentry/utils/duration/getDuration';
import {getExactDuration} from 'sentry/utils/duration/getExactDuration';

interface Props {
  seconds: number;
  abbreviation?: boolean;
  exact?: boolean;
  fixedDigits?: number;
}

export function Duration({
  seconds,
  fixedDigits,
  abbreviation,
  exact,
}: Props) {
  return (
    <span>
      {exact
        ? getExactDuration(seconds, abbreviation)
        : getDuration(seconds, fixedDigits, abbreviation)}
    </span>
  );
}
