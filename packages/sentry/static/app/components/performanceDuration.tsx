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

interface NanosecondsProps extends DurationProps {
  nanoseconds: number;
}

type PerformanceDurationProps = SecondsProps | MillisecondsProps | NanosecondsProps;

function isMilliseconds(props: PerformanceDurationProps): props is MillisecondsProps {
  return defined((props as MillisecondsProps).milliseconds);
}

function isNanoseconds(props: PerformanceDurationProps): props is NanosecondsProps {
  return defined((props as NanosecondsProps).nanoseconds);
}

function PerformanceDuration(props: PerformanceDurationProps) {
  const normalizedSeconds = isNanoseconds(props)
    ? props.nanoseconds / 1_000_000_000
    : isMilliseconds(props)
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
