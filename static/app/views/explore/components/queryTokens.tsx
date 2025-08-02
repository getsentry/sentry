import styled from '@emotion/styled';

import {ProvidedFormattedQuery} from 'sentry/components/searchQueryBuilder/formattedQuery';
import {parseQueryBuilderValue} from 'sentry/components/searchQueryBuilder/utils';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {getFieldDefinition} from 'sentry/utils/fields';
import {formatQueryToNaturalLanguage} from 'sentry/views/explore/utils';
import type {ChartType} from 'sentry/views/insights/common/components/chart';

interface QueryTokensProps {
  groupBys?: string[];
  query?: string;
  sort?: string;
  statsPeriod?: string;
  visualizations?: Array<{chartType: ChartType; yAxes: string[]}>;
}

function generateQueryTokensString({
  groupBys,
  query,
  sort,
  statsPeriod,
  visualizations,
}: QueryTokensProps): string {
  const parts = [];

  if (query) {
    const parsedQuery = parseQueryBuilderValue(query, getFieldDefinition);
    if (parsedQuery?.length) {
      const queryText = parsedQuery
        .filter(({text}) => text.trim() !== '')
        .map(({text}) => text)
        .join(' ');
      if (queryText) {
        const formattedFilter = formatQueryToNaturalLanguage(queryText.trim());
        parts.push(`Filter is '${formattedFilter}'`);
      }
    }
  }

  if (visualizations && visualizations.length > 0) {
    const vizParts = visualizations.flatMap(visualization =>
      visualization.yAxes.map(yAxis => yAxis)
    );
    if (vizParts.length > 0) {
      const vizText = vizParts.length === 1 ? vizParts[0] : vizParts.join(', ');
      parts.push(`visualizations are '${vizText}'`);
    }
  }

  if (groupBys && groupBys.length > 0) {
    const groupByText = groupBys.length === 1 ? groupBys[0] : groupBys.join(', ');
    parts.push(`groupBys are '${groupByText}'`);
  }

  if (statsPeriod && statsPeriod.length > 0) {
    parts.push(`time range is '${statsPeriod}'`);
  }

  if (sort && sort.length > 0) {
    const sortText = sort[0] === '-' ? `${sort.slice(1)} Desc` : `${sort} Asc`;
    parts.push(`sort is '${sortText}'`);
  }

  return parts.length > 0 ? parts.join(', ') : 'No query parameters set';
}

function QueryTokens({
  groupBys,
  query,
  sort,
  statsPeriod,
  visualizations,
}: QueryTokensProps) {
  const tokens = [];

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

  if (statsPeriod && statsPeriod.length > 0) {
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

  const readableQueryString = generateQueryTokensString({
    groupBys,
    query,
    sort,
    statsPeriod,
    visualizations,
  });

  return (
    <TokenContainer aria-label={`Query parameters: ${readableQueryString}`}>
      {tokens}
    </TokenContainer>
  );
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
