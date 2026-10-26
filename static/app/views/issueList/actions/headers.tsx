import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import {t} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';

type Props = {
  onSelectStatsPeriod: (statsPeriod: string) => void;
  selection: PageFilters;
  statsPeriod: string;
};

export function TrendHeader({selection, statsPeriod, onSelectStatsPeriod}: Props) {
  return (
    <Flex flex="1" justify="between">
      {t('Trend')}
      <GraphToggles>
        {selection.datetime.period !== '24h' && (
          <GraphToggle
            active={statsPeriod === '24h'}
            onClick={() => onSelectStatsPeriod('24h')}
          >
            {t('24h')}
          </GraphToggle>
        )}
        <GraphToggle
          active={statsPeriod === 'auto'}
          onClick={() => onSelectStatsPeriod('auto')}
        >
          {selection.datetime.period || t('Custom')}
        </GraphToggle>
      </GraphToggles>
    </Flex>
  );
}

const GraphToggles = styled('div')`
  font-weight: ${p => p.theme.font.weight.sans.regular};
`;

const GraphToggle = styled('a')<{active: boolean}>`
  font-size: ${p => p.theme.font.size.sm};
  padding-left: ${p => p.theme.space.md};

  &,
  &:hover,
  &:focus,
  &:active {
    color: ${p =>
      p.active ? p.theme.tokens.content.primary : p.theme.tokens.content.disabled};
  }
`;
