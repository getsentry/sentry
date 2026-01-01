import styled from '@emotion/styled';

import type {QueryTokensProps} from 'sentry/components/searchQueryBuilder/askSeerCombobox/types';
import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/context';
import {ProvidedFormattedQuery} from 'sentry/components/searchQueryBuilder/formattedQuery';
import {parseQueryBuilderValue} from 'sentry/components/searchQueryBuilder/utils';
import {t} from 'sentry/locale';

function formatDateRange(start: string, end: string): string {
  // Treat UTC dates as local dates by removing the 'Z' suffix
  // This ensures "2025-12-06T00:00:00Z" displays as Dec 6th in the user's timezone
  const startLocal = start.endsWith('Z') ? start.slice(0, -1) : start;
  const endLocal = end.endsWith('Z') ? end.slice(0, -1) : end;

  const startDate = new Date(startLocal);
  const endDate = new Date(endLocal);

  // Check if times are at midnight (date-only range)
  const startIsMidnight =
    startDate.getHours() === 0 &&
    startDate.getMinutes() === 0 &&
    startDate.getSeconds() === 0;
  const endIsMidnight =
    endDate.getHours() === 0 && endDate.getMinutes() === 0 && endDate.getSeconds() === 0;
  const endIsEndOfDay =
    endDate.getHours() === 23 &&
    endDate.getMinutes() === 59 &&
    endDate.getSeconds() === 59;

  // Use date-only format if both are midnight or end of day
  const useDateOnly = startIsMidnight && (endIsMidnight || endIsEndOfDay);

  const dateOptions: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  };

  const dateTimeOptions: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  };

  const formatOptions = useDateOnly ? dateOptions : dateTimeOptions;

  const startFormatted = startDate.toLocaleString('en-US', formatOptions);
  const endFormatted = endDate.toLocaleString('en-US', formatOptions);

  return `${startFormatted} - ${endFormatted}`;
}

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
        <ExploreGroupBys>{formatDateRange(start, end)}</ExploreGroupBys>
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
