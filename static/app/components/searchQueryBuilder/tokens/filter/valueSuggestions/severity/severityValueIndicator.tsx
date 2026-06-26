import styled from '@emotion/styled';

import {
  getSeverityColorVariant,
  type SeverityColorVariant,
} from 'sentry/components/searchQueryBuilder/tokens/filter/valueSuggestions/severity/utils';

const SeverityDot = styled('span')<{variant: SeverityColorVariant}>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  align-self: center;
  background-color: ${p => p.theme.tokens.graphics[p.variant].vibrant};
`;

interface SeverityValueIndicatorProps {
  value: string;
}

export function SeverityValueIndicator({value}: SeverityValueIndicatorProps) {
  return (
    <SeverityDot
      variant={getSeverityColorVariant(value)}
      data-test-id="severity-indicator"
      aria-hidden
    />
  );
}
