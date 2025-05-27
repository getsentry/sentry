import styled from '@emotion/styled';

import {ProvidedFormattedQuery} from 'sentry/components/searchQueryBuilder/formattedQuery';
import {parseQueryBuilderValue} from 'sentry/components/searchQueryBuilder/utils';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {getFieldDefinition} from 'sentry/utils/fields';

interface QueryTokensProps {
  result: {
    group_by?: string[];
    query?: string;
    sort?: string;
    stats_period?: string;
    visualization?: Array<{y_axes: string[]}>;
  };
}

function QueryTokens({result}: QueryTokensProps) {
  const tokens = [];

  const parsedQuery = result.query
    ? parseQueryBuilderValue(result.query, getFieldDefinition)
    : null;
  if (result.query && parsedQuery?.length) {
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

  if (result.visualization && result.visualization.length > 0) {
    tokens.push(
      <Token key="visualization">
        <ExploreParamTitle>{t('Visualization')}</ExploreParamTitle>
        {result.visualization.map((visualization, vIdx) =>
          visualization.y_axes.map(y_axis => (
            <ExploreVisualizes key={`${vIdx}-${y_axis}`}>{y_axis}</ExploreVisualizes>
          ))
        )}
      </Token>
    );
  }

  if (result.group_by && result.group_by.length > 0) {
    tokens.push(
      <Token key="groupBy">
        <ExploreParamTitle>{t('Group By')}</ExploreParamTitle>
        {result.group_by.map(groupBy => (
          <ExploreGroupBys key={groupBy}>{groupBy}</ExploreGroupBys>
        ))}
      </Token>
    );
  }

  if (result.stats_period && result.stats_period.length > 0) {
    tokens.push(
      <Token key="timeRange">
        <ExploreParamTitle>{t('Time Range')}</ExploreParamTitle>
        <ExploreGroupBys key={result.stats_period}>{result.stats_period}</ExploreGroupBys>
      </Token>
    );
  }

  if (result.sort && result.sort.length > 0) {
    tokens.push(
      <Token key="sort">
        <ExploreParamTitle>{t('Sort')}</ExploreParamTitle>
        <ExploreGroupBys key={result.sort}>
          {result.sort[0] === '-' ? result.sort.slice(1) + ' Desc' : result.sort + ' Asc'}
        </ExploreGroupBys>
      </Token>
    );
  }

  return <TokenContainer>{tokens}</TokenContainer>;
}

export default QueryTokens;

const TokenContainer = styled('div')`
  display: flex;
  gap: ${space(1)};
  padding: ${space(1)};
`;

const Token = styled('span')`
  display: flex;
  flex-direction: row;
  gap: ${space(0.5)};
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
  background: ${p => p.theme.background};
  padding: ${space(0.25)} ${space(0.5)};
  border: 1px solid ${p => p.theme.innerBorder};
  border-radius: ${p => p.theme.borderRadius};
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
