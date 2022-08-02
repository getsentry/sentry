import {getDuration, getExactDuration} from 'sentry/utils/formatters';

interface Props extends React.HTMLAttributes<HTMLSpanElement> {
  seconds: number;
  abbreviation?: boolean;
  exact?: boolean;
  fixedDigits?: number;
}

const Duration = ({seconds, fixedDigits, abbreviation, exact, ...props}: Props) => (
  <span {...props}>
    {exact
      ? getExactDuration(seconds, abbreviation)
      : getDuration(seconds, fixedDigits, abbreviation)}
  </span>
);

export default Duration;
