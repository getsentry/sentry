import styled from '@emotion/styled';

import {StatusIndicator} from '@sentry/scraps/statusIndicator';

import {getSeverityColorVariant} from 'sentry/components/searchQueryBuilder/tokens/filter/valueSuggestions/severity/utils';

interface SeverityValueIndicatorProps {
  value: string;
}

const SeverityDot = styled(StatusIndicator)`
  align-self: center;
`;

export function SeverityValueIndicator({value}: SeverityValueIndicatorProps) {
  return (
    <SeverityDot
      animationIterationCount={0}
      data-test-id="severity-indicator"
      variant={getSeverityColorVariant(value)}
    />
  );
}
