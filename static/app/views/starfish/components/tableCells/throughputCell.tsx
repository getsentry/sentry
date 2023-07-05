import {t} from 'sentry/locale';
import {NumberContainer} from 'sentry/utils/discover/styles';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';

type Props = {
  containerProps?: React.DetailedHTMLProps<
    React.HTMLAttributes<HTMLDivElement>,
    HTMLDivElement
  >;
  throughputPerSecond?: number;
};

export default function ThroughputCell({throughputPerSecond, containerProps}: Props) {
  const throughput = throughputPerSecond ? throughputPerSecond.toFixed(2) : '--';

  return (
    <NumberContainer {...containerProps}>
      {formatAbbreviatedNumber(throughput)}/{t('s')}
    </NumberContainer>
  );
}
