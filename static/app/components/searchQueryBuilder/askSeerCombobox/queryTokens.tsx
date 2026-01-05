import styled from '@emotion/styled';

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
      <Token key="filter">
        <ExploreParamTitle>{t('Filter')}</ExploreParamTitle>
        {parsedQuery
          .filter(({text}) => text.trim() !== '')
          .map(({text}) => (
            <FormattedQueryWrapper key={text}>
              <ProvidedFormattedQuery query={text} />
            </FormattedQueryWrapper>
          ))}
      </Token>
    );
  }

  if (visualizations && visualizations.length > 0) {
    tokens.push(
      <Token key="visualization">
        <ExploreParamTitle>{t('Visualization')}</ExploreParamTitle>
        {visualizations.map((visualization, vIdx) =>
          visualization.yAxes.map(yAxis => (
            <ExploreVisualizes key={`${vIdx}-${yAxis}`}>{yAxis}</ExploreVisualizes>
          ))
        )}
      </Token>
    );
  }

  if (groupBys && groupBys.length > 0) {
    tokens.push(
      <Token key="groupBy">
        <ExploreParamTitle>{t('Group By')}</ExploreParamTitle>
        {groupBys.map((groupBy, idx) => (
          <ExploreGroupBys key={idx}>{groupBy}</ExploreGroupBys>
        ))}
      </Token>
    );
  }

  // Display absolute date range if start and end are provided
  if (start && end) {
    tokens.push(
      <Token key="timeRange">
        <ExploreParamTitle>{t('Time Range')}</ExploreParamTitle>
        <ExploreGroupBys>{formatDateRange(start, end, ' - ')}</ExploreGroupBys>
      </Token>
    );
  } else if (statsPeriod && statsPeriod.length > 0) {
    tokens.push(
      <Token key="timeRange">
        <ExploreParamTitle>{t('Time Range')}</ExploreParamTitle>
        <ExploreGroupBys>{statsPeriod}</ExploreGroupBys>
      </Token>
    );
  }

  if (sort && sort.length > 0) {
    tokens.push(
      <Token key="sort">
        <ExploreParamTitle>{t('Sort')}</ExploreParamTitle>
        <ExploreGroupBys>
          {sort[0] === '-' ? sort.slice(1) + ' Desc' : sort + ' Asc'}
        </ExploreGroupBys>
      </Token>
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

const Token = styled('span')`
  display: flex;
  flex-direction: row;
  gap: ${p => p.theme.space.xs};
  overflow: hidden;
  flex-wrap: wrap;
  align-items: center;
`;

const ExploreParamTitle = styled('span')`
  font-size: ${p => p.theme.form.sm.fontSize};
  color: ${p => p.theme.subText};
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  height: 24px;
`;

const ExploreVisualizes = styled('span')`
  font-size: ${p => p.theme.form.sm.fontSize};
  background: ${p => p.theme.tokens.background.primary};
  padding: ${p => p.theme.space['2xs']} ${p => p.theme.space.xs};
  border: 1px solid ${p => p.theme.innerBorder};
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
