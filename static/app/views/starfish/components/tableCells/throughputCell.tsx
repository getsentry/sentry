import {RateUnits} from 'sentry/utils/discover/fields';
import {NumberContainer} from 'sentry/utils/discover/styles';
import formatThroughput from 'sentry/views/starfish/utils/chartValueFormatters/formatThroughput';

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
    <NumberContainer {...containerProps}>{formatThroughput(rate, unit)}</NumberContainer>
  );
}
