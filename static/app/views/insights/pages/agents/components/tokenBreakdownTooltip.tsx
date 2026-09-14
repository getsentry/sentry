import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';

export interface TokenBreakdownDetails {
  cacheRead: number;
  cacheWrite: number;
  input: number;
  isComplete: boolean;
  output: number;
  reasoning: number;
  total: number;
  model?: string;
}

export function TokenBreakdownTooltip({
  breakdowns,
}: {
  breakdowns: TokenBreakdownDetails[];
}) {
  return (
    <Stack gap="md">
      {breakdowns.map((breakdown, index) => (
        <Fragment key={breakdown.model ?? index}>
          {breakdown.model && (
            <Text size="sm" bold>
              {breakdown.model}
            </Text>
          )}
          <TokenBreakdownGrid>
            {breakdown.isComplete ? <CompleteBreakdown breakdown={breakdown} /> : null}
            <span>{t('Total')}</span>
            <span>{breakdown.total.toLocaleString()}</span>
          </TokenBreakdownGrid>
        </Fragment>
      ))}
    </Stack>
  );
}

function CompleteBreakdown({breakdown}: {breakdown: TokenBreakdownDetails}) {
  const hasInputSubcategories = breakdown.cacheRead > 0 || breakdown.cacheWrite > 0;
  const hasOutputSubcategories = breakdown.reasoning > 0;
  const nonCachedInput = Math.max(
    0,
    breakdown.input - breakdown.cacheRead - breakdown.cacheWrite
  );
  const nonReasoningOutput = Math.max(0, breakdown.output - breakdown.reasoning);

  return (
    <Fragment>
      <span>{t('Input')}</span>
      <span>{breakdown.input.toLocaleString()}</span>
      {hasInputSubcategories && (
        <Fragment>
          <TokenBreakdownSubrow>{t('Non-cached')}</TokenBreakdownSubrow>
          <span>{nonCachedInput.toLocaleString()}</span>
          {breakdown.cacheRead > 0 && (
            <Fragment>
              <TokenBreakdownSubrow>{t('Cache Read')}</TokenBreakdownSubrow>
              <span>{breakdown.cacheRead.toLocaleString()}</span>
            </Fragment>
          )}
          {breakdown.cacheWrite > 0 && (
            <Fragment>
              <TokenBreakdownSubrow>{t('Cache Write')}</TokenBreakdownSubrow>
              <span>{breakdown.cacheWrite.toLocaleString()}</span>
            </Fragment>
          )}
        </Fragment>
      )}
      <span>{t('Output')}</span>
      <span>{breakdown.output.toLocaleString()}</span>
      {hasOutputSubcategories && (
        <Fragment>
          <TokenBreakdownSubrow>{t('Non-reasoning')}</TokenBreakdownSubrow>
          <span>{nonReasoningOutput.toLocaleString()}</span>
          <TokenBreakdownSubrow>{t('Reasoning')}</TokenBreakdownSubrow>
          <span>{breakdown.reasoning.toLocaleString()}</span>
        </Fragment>
      )}
    </Fragment>
  );
}

const TokenBreakdownGrid = styled('div')`
  display: grid;
  grid-template-columns: 1fr auto;
  gap: ${p => p.theme.space.xs} ${p => p.theme.space.md};

  > *:nth-child(odd) {
    text-align: left;
  }

  > *:nth-child(even) {
    text-align: right;
  }
`;

const TokenBreakdownSubrow = styled('span')`
  padding-left: ${p => p.theme.space.md};
  color: ${p => p.theme.tokens.content.secondary};
`;
