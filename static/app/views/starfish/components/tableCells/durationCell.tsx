import Duration from 'sentry/components/duration';

type Props = {
  seconds: number;
};

export default function DurationCell({seconds}: Props) {
  return <Duration seconds={seconds} fixedDigits={2} abbreviation />;
}
