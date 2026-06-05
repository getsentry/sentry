import {Duration} from 'sentry/components/duration';

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
  return (props as MillisecondsProps).milliseconds != null;
}

function isNanoseconds(props: PerformanceDurationProps): props is NanosecondsProps {
  return (props as NanosecondsProps).nanoseconds != null;
}

export function PerformanceDuration(props: PerformanceDurationProps) {
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
