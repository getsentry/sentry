import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import type {QueryTokensProps} from 'sentry/components/searchQueryBuilder/askSeerCombobox/types';
import {formatDateRange} from 'sentry/components/searchQueryBuilder/askSeerCombobox/utils';
import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/context';
import {ProvidedFormattedQuery} from 'sentry/components/searchQueryBuilder/formattedQuery';
import {parseQueryBuilderValue} from 'sentry/components/searchQueryBuilder/utils';
import {t} from 'sentry/locale';

function QueryTokens({
  groupBys,
  query,
  sort,
  statsPeriod,
  start,
  end,
  visualizations,
}: QueryTokensProps) {
  const tokens = [];
  const {getFieldDefinition} = useSearchQueryBuilder();
  const parsedQuery = query ? parseQueryBuilderValue(query, getFieldDefinition) : null;
  if (query && parsedQuery?.length) {
    tokens.push(
      <Flex as="span" align="center" wrap="wrap" gap="xs" overflow="hidden" key="filter">
        <ExploreParamTitle>{t('Filter')}</ExploreParamTitle>
        {parsedQuery
          .filter(({text}) => text.trim() !== '')
          .map(({text}) => (
            <FormattedQueryWrapper key={text}>
              <ProvidedFormattedQuery query={text} />
            </FormattedQueryWrapper>
          ))}
      </Flex>
    );
  }

  if (visualizations && visualizations.length > 0) {
    tokens.push(
      <Flex
        as="span"
        align="center"
        wrap="wrap"
        gap="xs"
        overflow="hidden"
        key="visualization"
      >
        <ExploreParamTitle>{t('Visualization')}</ExploreParamTitle>
        {visualizations.map((visualization, vIdx) =>
          visualization.yAxes.map(yAxis => (
            <ExploreVisualizes key={`${vIdx}-${yAxis}`}>{yAxis}</ExploreVisualizes>
          ))
        )}
      </Flex>
    );
  }

  if (groupBys && groupBys.length > 0) {
    tokens.push(
      <Flex as="span" align="center" wrap="wrap" gap="xs" overflow="hidden" key="groupBy">
        <ExploreParamTitle>{t('Group By')}</ExploreParamTitle>
        {groupBys.map((groupBy, idx) => (
          <ExploreGroupBys key={idx}>{groupBy}</ExploreGroupBys>
        ))}
      </Flex>
    );
  }

  // Display absolute date range if start and end are provided
  if (start && end) {
    tokens.push(
      <Flex
        as="span"
        align="center"
        wrap="wrap"
        gap="xs"
        overflow="hidden"
        key="timeRange"
      >
        <ExploreParamTitle>{t('Time Range')}</ExploreParamTitle>
        <ExploreGroupBys>{formatDateRange(start, end, ' - ')}</ExploreGroupBys>
      </Flex>
    );
  } else if (statsPeriod && statsPeriod.length > 0) {
    tokens.push(
      <Flex
        as="span"
        align="center"
        wrap="wrap"
        gap="xs"
        overflow="hidden"
        key="timeRange"
      >
        <ExploreParamTitle>{t('Time Range')}</ExploreParamTitle>
        <ExploreGroupBys>{statsPeriod}</ExploreGroupBys>
      </Flex>
    );
  }

  if (sort && sort.length > 0) {
    tokens.push(
      <Flex as="span" align="center" wrap="wrap" gap="xs" overflow="hidden" key="sort">
        <ExploreParamTitle>{t('Sort')}</ExploreParamTitle>
        <ExploreGroupBys>
          {sort[0] === '-' ? sort.slice(1) + ' Desc' : sort + ' Asc'}
        </ExploreGroupBys>
      </Flex>
    );
  }

  return <TokenContainer>{tokens}</TokenContainer>;
}

export default QueryTokens;

const TokenContainer = styled('div')`
  display: flex;
  gap: ${p => p.theme.space.md};
  padding: ${p => p.theme.space.md};
`;

const ExploreParamTitle = styled('span')`
  font-size: ${p => p.theme.form.sm.fontSize};
  color: ${p => p.theme.tokens.content.secondary};
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  height: 24px;
`;

const ExploreVisualizes = styled('span')`
  font-size: ${p => p.theme.form.sm.fontSize};
  background: ${p => p.theme.tokens.background.primary};
  padding: ${p => p.theme.space['2xs']} ${p => p.theme.space.xs};
  border: 1px solid ${p => p.theme.tokens.border.secondary};
  border-radius: ${p => p.theme.radius.md};
  height: 24px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  display: inline-flex;
  align-items: center;
`;

const ExploreGroupBys = ExploreVisualizes;

const FormattedQueryWrapper = styled('span')`
  display: inline-block;
`;
