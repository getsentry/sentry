import {NumberContainer} from 'sentry/utils/discover/styles';
import {formatDollars} from 'sentry/utils/formatters';
import {NegativeCostInfo} from 'sentry/views/insights/pages/agents/components/negativeCostWarning';

type Props = {
  value: number | null;
};

export function CurrencyCell({value}: Props) {
  if (value === null || value === undefined) {
    return <NumberContainer>{'\u2014'}</NumberContainer>;
  }

  if (value < 0) {
    return (
      <NumberContainer>
        <NegativeCostInfo cost={value} />
      </NumberContainer>
    );
  }

  if (value > 0 && value < 0.01) {
    return <NumberContainer>{`<$${(0.01).toLocaleString()}`}</NumberContainer>;
  }

  return <NumberContainer>{formatDollars(value)}</NumberContainer>;
}
