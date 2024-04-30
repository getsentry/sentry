import {PercentChange} from 'sentry/components/percentChange';
import {NumberContainer} from 'sentry/utils/discover/styles';

type PercentChangeCellProps = {
  deltaValue: number;
  colorize?: boolean;
};

export function PercentChangeCell({deltaValue, colorize = true}: PercentChangeCellProps) {
  return (
    <NumberContainer>
      <PercentChange value={deltaValue} colorize={colorize} />
    </NumberContainer>
  );
}
