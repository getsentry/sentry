import {useCallback, useMemo} from 'react';
import type {Location} from 'history';

import {defined} from 'sentry/utils/defined';
import {parseFunction, type Sort} from 'sentry/utils/discover/fields';
import {decodeSorts, encodeSort} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {defaultAggregateSortBys} from 'sentry/views/explore/contexts/pageParamsContext/aggregateSortBys';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {defaultSortBys} from 'sentry/views/explore/contexts/pageParamsContext/sortBys';
import {
  DEFAULT_VISUALIZATION,
  DEFAULT_VISUALIZATION_FIELD,
} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import {
  applyQueryParamsUpdates,
  loadQueryParamsFromLocation,
  parseAsRawList,
} from 'sentry/views/explore/queryParams/parsers';
import {buildConditionalAggregate} from 'sentry/views/explore/utils/conditionalAggregate';
import {parseConditionalAggregate} from 'sentry/views/explore/utils/parseConditionalAggregate';
import {ChartType} from 'sentry/views/insights/common/components/chart';

// Read utils begin

export type ExploreCaseSensitivity = '1' | '0' | null;

export type ReadableExploreQueryParts = {
  fields: string[];
  groupBys: string[];
  query: string;
  sortBys: Sort[];
  yAxes: string[];
  caseInsensitive?: ExploreCaseSensitivity;
  chartType?: ChartType;
};

const DEFAULT_QUERY: ReadableExploreQueryParts = {
  yAxes: [DEFAULT_VISUALIZATION],
  sortBys: [{kind: 'desc', field: 'timestamp'}],
  fields: ['id', DEFAULT_VISUALIZATION_FIELD, 'timestamp'],
  groupBys: [],
  query: '',
};

function validateSortBys(
  parsedSortBys: Sort[],
  groupBys?: string[],
  fields?: string[],
  yAxes?: string[]
): Sort[] {
  const mode = getQueryMode(groupBys);

  if (mode === Mode.SAMPLES) {
    if (parsedSortBys.length > 0) {
      if (parsedSortBys.every(sort => fields?.includes(sort.field))) {
        return parsedSortBys;
      }
      return [
        {
          field: 'timestamp',
          kind: 'desc' as const,
        },
      ];
    }

    return defaultSortBys(fields ?? []);
  }

  if (mode === Mode.AGGREGATE) {
    if (parsedSortBys.length > 0) {
      if (
        parsedSortBys.every(
          sort => groupBys?.includes(sort.field) || yAxes?.includes(sort.field)
        )
      ) {
        return parsedSortBys;
      }
    }

    return defaultAggregateSortBys(yAxes ?? []);
  }

  return [];
}

/**
 * AND binds tighter than OR in search syntax, so concatenating
 * `base left OR right` is `(base AND left) OR right`. Wrap sides that
 * contain OR so Compare keeps `base AND (left OR right)`.
 */
function wrapQueryForMerge(query: string): string {
  return /\bOR\b/.test(query) ? `(${query})` : query;
}

function mergeCompareQueryFilters(baseQuery: string, seriesFilter: string): string {
  const base = baseQuery.trim();
  const filter = seriesFilter.trim();
  if (!filter) {
    return base;
  }
  if (!base) {
    return filter;
  }
  return `${wrapQueryForMerge(base)} ${wrapQueryForMerge(filter)}`;
}

/**
 * Compare queries use the top-level filter bar instead of per-series `_if` filters.
 * Move any EAP conditional aggregate into `{query, yAxes}` form the compare UI can edit.
 */
export function normalizeCompareQueryParts(
  query: WritableExploreQueryParts
): WritableExploreQueryParts {
  let mergedQuery = query.query ?? '';
  const normalizedYAxes: string[] = [];
  const yAxisReplacements = new Map<string, string>();

  for (const yAxis of query.yAxes ?? []) {
    const conditional = parseConditionalAggregate(yAxis);
    if (!conditional?.filter) {
      normalizedYAxes.push(yAxis);
      continue;
    }

    mergedQuery = mergeCompareQueryFilters(mergedQuery, conditional.filter);
    const plainYAxis = buildConditionalAggregate({
      name: conditional.name,
      arguments: conditional.arguments,
      filter: '',
    });
    yAxisReplacements.set(yAxis, plainYAxis);
    normalizedYAxes.push(plainYAxis);
  }

  const normalizedSortBys = query.sortBys?.map(sort => {
    const replacement = yAxisReplacements.get(sort.field);
    return replacement ? {...sort, field: replacement} : sort;
  });

  return {
    ...query,
    query: mergedQuery,
    yAxes: normalizedYAxes,
    sortBys: normalizedSortBys,
  };
}

function parseQuery(raw: string): ReadableExploreQueryParts {
  try {
    const parsed = JSON.parse(raw);
    if (!defined(parsed) || !Array.isArray(parsed.yAxes)) {
      return DEFAULT_QUERY;
    }

    const yAxes = parsed.yAxes;
    const parsedFunctions = yAxes.map(parseFunction).filter(defined);
    if (parsedFunctions.length <= 0) {
      return DEFAULT_QUERY;
    }

    let chartType: number | undefined = Number(parsed.chartType);
    if (isNaN(chartType) || !Object.values(ChartType).includes(chartType)) {
      chartType = undefined;
    }

    const groupBys: string[] = parsed.groupBys ?? [];
    const fields = getFieldsForConstructedQuery(yAxes);

    const parsedSortBys = decodeSorts(parsed.sortBys);
    const sortBys = validateSortBys(parsedSortBys, groupBys, fields, yAxes);

    const caseInsensitive = decodeCompareCaseInsensitive(parsed.caseInsensitive);

    const normalized = normalizeCompareQueryParts({
      yAxes,
      chartType,
      sortBys,
      query: parsed.query ?? '',
      groupBys,
      caseInsensitive,
    });

    const normalizedFields = getFieldsForConstructedQuery(normalized.yAxes ?? yAxes);
    const normalizedSortBys = validateSortBys(
      [...(normalized.sortBys ?? sortBys)],
      groupBys,
      normalizedFields,
      normalized.yAxes ?? yAxes
    );

    return {
      yAxes: normalized.yAxes ?? yAxes,
      chartType: normalized.chartType ?? chartType,
      sortBys: normalizedSortBys,
      query: normalized.query ?? '',
      groupBys,
      fields: normalizedFields,
      caseInsensitive: normalized.caseInsensitive ?? caseInsensitive,
    };
  } catch (error) {
    return DEFAULT_QUERY;
  }
}

const MULTI_QUERY_PARSERS = {queries: parseAsRawList};

export function useReadQueriesFromLocation(): ReadableExploreQueryParts[] {
  const location = useLocation();

  return useMemo(() => {
    const rawQueries = loadQueryParamsFromLocation(MULTI_QUERY_PARSERS, location).queries;
    if (rawQueries.length === 0) {
      return [DEFAULT_QUERY];
    }
    return rawQueries.map(parseQuery);
  }, [location]);
}

// Read utils end

// Write utils begin

type WritableExploreQueryParts = {
  caseInsensitive?: ExploreCaseSensitivity;
  chartType?: ChartType;
  fields?: string[];
  groupBys?: readonly string[];
  query?: string;
  sortBys?: readonly Sort[];
  yAxes?: string[];
};

export function encodeCompareCaseInsensitive(
  caseInsensitive: ExploreCaseSensitivity | undefined
) {
  // Older bundles/URLs read this value by truthiness, so explicit match case
  // is written as `false` rather than '0' to stay falsy for them.
  if (caseInsensitive === '0') {
    return false;
  }

  return caseInsensitive === '1' ? '1' : undefined;
}

function decodeCompareCaseInsensitive(
  value: unknown
): ExploreCaseSensitivity | undefined {
  switch (value) {
    case '0':
    case '1':
      return value;
    case false:
      return '0';
    default:
      return undefined;
  }
}

function getQueriesAsUrlParam(queries: WritableExploreQueryParts[]): string[] {
  return queries.map(query =>
    JSON.stringify({
      chartType: query.chartType,
      caseInsensitive: encodeCompareCaseInsensitive(query.caseInsensitive),
      fields: query.fields,
      groupBys: query.groupBys,
      query: query.query,
      sortBys: query.sortBys?.map(encodeSort),
      yAxes: query.yAxes,
    })
  );
}

function getUpdatedLocationWithQueries(
  location: Location,
  queries: WritableExploreQueryParts[]
) {
  return applyQueryParamsUpdates(MULTI_QUERY_PARSERS, location, {
    queries: getQueriesAsUrlParam(queries),
  });
}

export function useUpdateQueryAtIndex(index: number) {
  const location = useLocation();
  const queries = useReadQueriesFromLocation();
  const navigate = useNavigate();

  return useCallback(
    (updates: Partial<WritableExploreQueryParts>) => {
      const queryToUpdate = queries[index];
      if (!queryToUpdate) {
        return;
      }

      const newQuery = {...queryToUpdate, ...updates};
      newQuery.fields = getFieldsForConstructedQuery(newQuery.yAxes);
      const newQueries = queries.map((query, i) => (i === index ? newQuery : query));

      const target = getUpdatedLocationWithQueries(location, newQueries);
      navigate(target);
    },
    [index, location, navigate, queries]
  );
}

export function useAddQuery() {
  const location = useLocation();
  const queries = useReadQueriesFromLocation();
  const navigate = useNavigate();

  return useCallback(() => {
    const target = getUpdatedLocationWithQueries(location, [...queries, DEFAULT_QUERY]);
    navigate(target);
  }, [location, navigate, queries]);
}

export function useDeleteQueryAtIndex() {
  const location = useLocation();
  const queries = useReadQueriesFromLocation();
  const navigate = useNavigate();

  return useCallback(
    (index: number) => {
      const newQueries = queries.toSpliced(index, 1);
      const target = getUpdatedLocationWithQueries(location, newQueries);
      navigate(target);
    },
    [location, navigate, queries]
  );
}

export function useDuplicateQueryAtIndex() {
  const location = useLocation();
  const queries = useReadQueriesFromLocation();
  const navigate = useNavigate();

  return useCallback(
    (index: number) => {
      const query = queries[index];
      if (defined(query)) {
        const duplicate = structuredClone(query);
        const newQueries = queries.toSpliced(index + 1, 0, duplicate);
        const target = getUpdatedLocationWithQueries(location, newQueries);
        navigate(target);
      }
    },
    [location, navigate, queries]
  );
}

export function getSamplesTargetAtIndex(
  index: number,
  queries: ReadableExploreQueryParts[],
  row: Record<string, any>,
  location: Location
): Location {
  const queryToUpdate = queries[index];
  if (!queryToUpdate) {
    return location;
  }

  const queryString = queryToUpdate.query ?? '';
  const search = new MutableSearch(queryString);
  for (const groupBy of queryToUpdate.groupBys) {
    if (!groupBy) {
      continue;
    }
    const value = row[groupBy];
    search.setFilterValues(groupBy, [value]);
  }

  const newQuery = {...queryToUpdate, groupBys: [], query: search.formatString()};
  newQuery.fields = getFieldsForConstructedQuery(newQuery.yAxes);
  const newQueries = [...queries];
  newQueries[index] = newQuery;

  const target = getUpdatedLocationWithQueries(location, newQueries);

  return target;
}

// Write utils end

// General utils

export function getFieldsForConstructedQuery(yAxes: string[]): string[] {
  const fields: string[] = ['id'];

  for (const yAxis of yAxes) {
    // Prefer parseConditionalAggregate so EAP `_if` filters are not treated as columns.
    const arg = parseConditionalAggregate(yAxis)?.arguments[0];
    if (!arg) {
      continue;
    }
    if (fields.includes(arg)) {
      continue;
    }
    fields.push(arg);
  }

  fields.push('timestamp');

  return fields;
}

export function getQueryMode(groupBys?: string[]): Mode {
  return groupBys?.length === 0 ? Mode.SAMPLES : Mode.AGGREGATE;
}
