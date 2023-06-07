import Duration from 'sentry/components/duration';

type Props = {
  milliseconds: number;
};

export default function DurationCell({milliseconds}: Props) {
  return <Duration seconds={milliseconds / 1000} fixedDigits={2} abbreviation />;
}
