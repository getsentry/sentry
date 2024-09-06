import {PercentChange} from 'sentry/components/percentChange';
import {NumberContainer} from 'sentry/utils/discover/styles';

type PercentChangeCellProps = {
  deltaValue: number;
  colorize?: boolean;
  preferredPolarity?: '+' | '-';
};

export function PercentChangeCell({
  deltaValue,
  preferredPolarity,
  colorize = true,
}: PercentChangeCellProps) {
  return (
    <NumberContainer>
      <PercentChange
        value={deltaValue}
        colorize={colorize}
        preferredPolarity={preferredPolarity}
      />
    </NumberContainer>
  );
}
