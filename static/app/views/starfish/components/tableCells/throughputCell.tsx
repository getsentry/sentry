import {RateUnits} from 'sentry/utils/discover/fields';
import {NumberContainer} from 'sentry/utils/discover/styles';
import {formatRate} from 'sentry/utils/formatters';

type Props = {
  unit: RateUnits;
  containerProps?: React.DetailedHTMLProps<
    React.HTMLAttributes<HTMLDivElement>,
    HTMLDivElement
  >;
  rate?: number;
};

export function ThroughputCell({rate, unit, containerProps}: Props) {
  return (
    <NumberContainer {...containerProps}>
      {rate ? formatRate(rate, unit, {minimumValue: 0.001}) : '--'}
    </NumberContainer>
  );
}
