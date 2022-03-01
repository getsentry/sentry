import Duration from 'sentry/components/duration';
import {defined} from 'sentry/utils';

interface DurationProps {
  abbreviation?: boolean;
}

interface SecondsProps extends DurationProps {
  seconds: number;
}

interface MillisecondsProps extends DurationProps {
  milliseconds: number;
}

type PerformanceDurationProps = SecondsProps | MillisecondsProps;

function hasMilliseconds(props: PerformanceDurationProps): props is MillisecondsProps {
  return defined((props as MillisecondsProps).milliseconds);
}

function PerformanceDuration(props: PerformanceDurationProps) {
  const normalizedSeconds = hasMilliseconds(props)
    ? props.milliseconds / 1000
    : props.seconds;

  return (
    <Duration
      abbreviation={props.abbreviation}
      seconds={normalizedSeconds}
      fixedDigits={2}
    />
  );
}

export default PerformanceDuration;
