import {BooleanOperator} from 'sentry/components/searchSyntax/parser';

function constructQueryString(queryObject: Record<string, string>) {
  return Object.entries(queryObject)
    .map(([key, value]) => `${key}:"${value}"`)
    .join(' ');
}

export function extendQueryWithGroupBys(
  query: string = '',
  groupBys?: (Record<string, string> | undefined)[]
) {
  const focusedSeriesQuery = groupBys
    ?.map(groupBy => {
      if (!groupBy || Object.keys(groupBy).length === 0) {
        return '';
      }
      return `${constructQueryString(groupBy)}`;
    })
    .filter(Boolean)
    .join(` ${BooleanOperator.OR} `);

  if (!focusedSeriesQuery) {
    return query;
  }

  if (!query) {
    return focusedSeriesQuery;
  }

  return `(${query}) AND (${focusedSeriesQuery})`;
}
