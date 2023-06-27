import Duration from 'sentry/components/duration';
import {NumberContainer} from 'sentry/utils/discover/styles';

type Props = {
  milliseconds: number;
};

export default function DurationCell({milliseconds}: Props) {
  return (
    <NumberContainer>
      <Duration seconds={milliseconds / 1000} fixedDigits={2} abbreviation />
    </NumberContainer>
  );
}
