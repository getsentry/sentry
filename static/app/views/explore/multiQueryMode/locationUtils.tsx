import {useCallback, useMemo} from 'react';
import type {Location} from 'history';
import {parseAsJson} from 'nuqs';
import {z} from 'zod';

import {defined} from 'sentry/utils/defined';
import {parseFunction, type Sort} from 'sentry/utils/discover/fields';
import {decodeSorts, encodeSort} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  hasIgnoreCaseDefault,
  isCaseIndependent,
} from 'sentry/views/explore/caseInsensitivityDefault';
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

const compareQuerySchema = z.object({
  caseInsensitive: z.literal(['0', '1', false]).optional().catch(undefined),
  chartType: z.preprocess(Number, z.enum(ChartType)).optional().catch(undefined),
  fields: z.array(z.string()).optional().catch(undefined),
  groupBys: z.array(z.string().catch('')).catch([]),
  query: z.string().catch(''),
  sortBys: z
    .union([z.string(), z.array(z.string().catch(''))])
    .optional()
    .catch(undefined),
  yAxes: z
    .array(z.string())
    .refine(yAxes => yAxes.some(yAxis => defined(parseFunction(yAxis)))),
});

const parseAsCompareQuery = parseAsJson(compareQuerySchema);

function parseQuery(raw: string): ReadableExploreQueryParts {
  const parsed = parseAsCompareQuery.parse(raw);
  if (!parsed) {
    return DEFAULT_QUERY;
  }

  const {chartType, groupBys, yAxes} = parsed;
  const fields = getFieldsForConstructedQuery(yAxes);

  const parsedSortBys = decodeSorts(parsed.sortBys);
  const sortBys = validateSortBys(parsedSortBys, groupBys, fields, yAxes);

  const caseInsensitive = parsed.caseInsensitive === false ? '0' : parsed.caseInsensitive;

  const normalized = normalizeCompareQueryParts({
    yAxes,
    chartType,
    sortBys,
    query: parsed.query,
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
}

function withCaseInsensitiveDefault(
  query: ReadableExploreQueryParts
): ReadableExploreQueryParts {
  if (defined(query.caseInsensitive)) {
    return query;
  }
  return {
    ...query,
    caseInsensitive: isCaseIndependent({
      query: query.query,
      yAxes: query.yAxes,
      groupBys: query.groupBys,
    })
      ? '1'
      : '0',
  };
}

const MULTI_QUERY_PARSERS = {queries: parseAsRawList};

export function useReadQueriesFromLocation(): ReadableExploreQueryParts[] {
  const location = useLocation();
  const organization = useOrganization();
  const ignoreCaseByDefault = hasIgnoreCaseDefault(organization);

  return useMemo(() => {
    const rawQueries = loadQueryParamsFromLocation(MULTI_QUERY_PARSERS, location).queries;
    const queries =
      rawQueries.length === 0 ? [DEFAULT_QUERY] : rawQueries.map(parseQuery);
    return ignoreCaseByDefault ? queries.map(withCaseInsensitiveDefault) : queries;
  }, [ignoreCaseByDefault, location]);
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

function getQueriesAsUrlParam(queries: ReadableExploreQueryParts[]): string[] {
  return queries.map(query =>
    parseAsCompareQuery.serialize({
      chartType: query.chartType,
      caseInsensitive: encodeCompareCaseInsensitive(query.caseInsensitive),
      fields: query.fields,
      groupBys: query.groupBys,
      query: query.query,
      sortBys: query.sortBys.map(encodeSort),
      yAxes: query.yAxes,
    })
  );
}

function getUpdatedLocationWithQueries(
  location: Location,
  queries: ReadableExploreQueryParts[]
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
    (updates: Partial<ReadableExploreQueryParts>) => {
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
