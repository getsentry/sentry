import {useTheme} from '@emotion/react';

import {Flex} from '@sentry/scraps/layout';

import {defined} from 'sentry/utils/defined';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';
import {ThresholdCell} from 'sentry/views/insights/pages/platform/shared/table/ThresholdCell';

export function ErrorRateCell({errorRate, total}: {errorRate: number; total: number}) {
  const theme = useTheme();
  const errorCount = Math.floor(errorRate * total);

  const errorCountElement = (
    <span style={{color: theme.tokens.content.secondary}}>
      ({formatAbbreviatedNumber(errorCount)})
    </span>
  );

  return (
    <ThresholdCell value={errorRate}>
      <Flex align="center" justify="end" gap="xs">
        {formatPercentage(errorRate, 2, {minimumValue: 0.0001})}
        {defined(errorCount) ? errorCountElement : null}
      </Flex>
    </ThresholdCell>
  );
}
