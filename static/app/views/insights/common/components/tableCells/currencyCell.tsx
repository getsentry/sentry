import {Tooltip} from '@sentry/scraps/tooltip';

import {NumberContainer} from 'sentry/utils/discover/styles';
import {formatDollars} from 'sentry/utils/formatters';
import {NegativeCostInfo} from 'sentry/views/insights/pages/agents/components/negativeCostWarning';
import {formatLLMCostsExact} from 'sentry/views/insights/pages/agents/utils/formatLLMCosts';

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

  if (value === 0) {
    return <NumberContainer>{formatDollars(value)}</NumberContainer>;
  }

  return (
    <NumberContainer>
      <Tooltip title={formatLLMCostsExact(value)} skipWrapper>
        <span>
          {value < 0.01 ? `<$${(0.01).toLocaleString()}` : formatDollars(value)}
        </span>
      </Tooltip>
    </NumberContainer>
  );
}
