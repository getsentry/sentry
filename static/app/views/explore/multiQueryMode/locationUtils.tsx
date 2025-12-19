import {useCallback, useMemo} from 'react';
import type {Location, LocationDescriptorObject} from 'history';

import {URL_PARAM} from 'sentry/constants/pageFilters';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {encodeSort} from 'sentry/utils/discover/eventView';
import {parseFunction, type Sort} from 'sentry/utils/discover/fields';
import {decodeList, decodeSorts} from 'sentry/utils/queryString';
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
import {ChartType} from 'sentry/views/insights/common/components/chart';
import {makeTracesPathname} from 'sentry/views/traces/pathnames';

// Read utils begin

export type ReadableExploreQueryParts = {
  fields: string[];
  groupBys: string[];
  query: string;
  sortBys: Sort[];
  yAxes: string[];
  caseInsensitive?: '1' | null;
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
    const fields: string[] = getFieldsForConstructedQuery(yAxes);

    const parsedSortBys = decodeSorts(parsed.sortBys);
    const sortBys = validateSortBys(parsedSortBys, groupBys, fields, yAxes);

    const caseInsensitive = parsed.caseInsensitive ?? undefined;

    return {
      yAxes,
      chartType,
      sortBys,
      query: parsed.query ?? '',
      groupBys,
      fields,
      caseInsensitive,
    };
  } catch (error) {
    return DEFAULT_QUERY;
  }
}

export function useReadQueriesFromLocation(): ReadableExploreQueryParts[] {
  const location = useLocation();
  const rawQueries = decodeList(location.query.queries);

  const parsedQueries = useMemo(() => {
    if (!defined(rawQueries) || rawQueries.length === 0) {
      return [DEFAULT_QUERY];
    }
    return rawQueries.map(parseQuery);
  }, [rawQueries]);

  return parsedQueries;
}

// Read utils end

// Write utils begin

type WritableExploreQueryParts = {
  caseInsensitive?: '1' | null;
  chartType?: ChartType;
  fields?: string[];
  groupBys?: readonly string[];
  query?: string;
  sortBys?: readonly Sort[];
  yAxes?: string[];
};

function getQueriesAsUrlParam(queries: WritableExploreQueryParts[]): string[] {
  return queries.map(query =>
    JSON.stringify({
      chartType: query.chartType,
      caseInsensitive: query.caseInsensitive,
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
  queries: WritableExploreQueryParts[] | null | undefined
) {
  const targetQueries = defined(queries) ? getQueriesAsUrlParam(queries) : null;
  return {
    ...location,
    query: {
      ...location.query,
      queries: targetQueries,
    },
  };
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
    const arg = parseFunction(yAxis)?.arguments[0];
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

function getCompareBaseUrl(organization: Organization) {
  return makeTracesPathname({
    organization,
    path: '/compare/',
  });
}

type CompareRouteProps = {
  location: Location;
  mode: Mode;
  organization: Organization;
  queries: WritableExploreQueryParts[];
  referrer?: string;
};

export function generateExploreCompareRoute({
  organization,
  location,
  mode,
  queries,
  referrer,
}: CompareRouteProps): LocationDescriptorObject {
  const url = getCompareBaseUrl(organization);
  const compareQueries = queries.map(query => ({
    ...query,
    // Filter out empty strings which are used to indicate no grouping
    // in Trace Explorer. The same assumption does not exist for the
    // comparison view.
    groupBys: mode === Mode.AGGREGATE ? query.groupBys?.filter(Boolean) : [],
  }));

  if (compareQueries.length < 2) {
    compareQueries.push(DEFAULT_QUERY);
  }
  const query = {
    [URL_PARAM.END]: location.query.end,
    [URL_PARAM.START]: location.query.start,
    [URL_PARAM.UTC]: location.query.utc,
    [URL_PARAM.PERIOD]: location.query.statsPeriod,
    [URL_PARAM.PROJECT]: location.query.project,
    [URL_PARAM.ENVIRONMENT]: location.query.environment,
    queries: getQueriesAsUrlParam(compareQueries),
  };

  if (referrer) {
    query.referrer = referrer;
  }

  return {
    pathname: url,
    query,
  };
}
