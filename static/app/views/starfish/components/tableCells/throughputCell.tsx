import {t} from 'sentry/locale';
import {NumberContainer} from 'sentry/utils/discover/styles';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';

type Props = {
  throughputUnit: string;
  containerProps?: React.DetailedHTMLProps<
    React.HTMLAttributes<HTMLDivElement>,
    HTMLDivElement
  >;
  throughput?: number;
};

export default function ThroughputCell({throughputPerSecond, containerProps}: Props) {
  const throughput = throughputPerSecond
    ? formatAbbreviatedNumber(throughputPerSecond)
    : '--';

  return (
    <NumberContainer {...containerProps}>
      {throughput}/{t('s')}
    </NumberContainer>
  );
}
