import Duration from 'sentry/components/duration';
import {NumberContainer} from 'sentry/utils/discover/styles';

type Props = {
  milliseconds: number;
  containerProps?: React.DetailedHTMLProps<
    React.HTMLAttributes<HTMLDivElement>,
    HTMLDivElement
  >;
};

export default function DurationCell({milliseconds, containerProps}: Props) {
  return (
    <NumberContainer {...containerProps}>
      <Duration seconds={milliseconds / 1000} fixedDigits={2} abbreviation />
    </NumberContainer>
  );
}
