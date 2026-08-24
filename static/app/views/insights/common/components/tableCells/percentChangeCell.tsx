import {PercentChange} from 'sentry/components/percentChange';
import {NumberContainer} from 'sentry/utils/discover/styles';

type PercentChangeCellProps = {
  deltaValue: number;
};

export function PercentChangeCell({deltaValue}: PercentChangeCellProps) {
  return (
    <NumberContainer>
      <PercentChange value={deltaValue} colorize />
    </NumberContainer>
  );
}
