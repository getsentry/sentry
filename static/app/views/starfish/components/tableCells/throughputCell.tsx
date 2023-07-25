import {RATE_UNIT_LABELS, RateUnits} from 'sentry/utils/discover/fieldRenderers';
import {NumberContainer} from 'sentry/utils/discover/styles';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';

type Props = {
  unit: RateUnits;
  containerProps?: React.DetailedHTMLProps<
    React.HTMLAttributes<HTMLDivElement>,
    HTMLDivElement
  >;
  rate?: number;
};

export default function ThroughputCell({rate, unit, containerProps}: Props) {
  return (
    <NumberContainer {...containerProps}>
      {rate ? formatAbbreviatedNumber(rate) : '--'}/{RATE_UNIT_LABELS[unit]}
    </NumberContainer>
  );
}
