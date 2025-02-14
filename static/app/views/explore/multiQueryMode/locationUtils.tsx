import {useCallback, useMemo} from 'react';
import type {Location} from 'history';

import {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import {encodeSort} from 'sentry/utils/discover/eventView';
import {parseFunction, type Sort} from 'sentry/utils/discover/fields';
import {decodeList, decodeSorts} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {defaultSortBys} from 'sentry/views/explore/contexts/pageParamsContext/sortBys';
import {
  DEFAULT_VISUALIZATION,
  DEFAULT_VISUALIZATION_FIELD,
} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import {ChartType} from 'sentry/views/insights/common/components/chart';

// Read utils begin

export type ReadableExploreQueryParts = {
  chartType: ChartType;
  fields: string[];
  groupBys: string[];
  query: string;
  sortBys: Sort[];
  yAxes: string[];
};

const DEFAULT_QUERY: ReadableExploreQueryParts = {
  chartType: ChartType.LINE,
  yAxes: [DEFAULT_VISUALIZATION],
  sortBys: [{kind: 'desc', field: DEFAULT_VISUALIZATION_FIELD!}],
  fields: ['id', DEFAULT_VISUALIZATION_FIELD!],
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

  if (parsedSortBys.length > 0) {
    if (
      mode === Mode.SAMPLES &&
      parsedSortBys.every(sort => fields?.includes(sort.field))
    ) {
      return parsedSortBys;
    }
    if (
      mode === Mode.AGGREGATE &&
      parsedSortBys.every(
        sort => groupBys?.includes(sort.field) || yAxes?.includes(sort.field)
      )
    ) {
      return parsedSortBys;
    }
  }
  return defaultSortBys(mode, fields ?? [], yAxes ?? []);
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

    let chartType = Number(parsed.chartType);
    if (isNaN(chartType) || !Object.values(ChartType).includes(chartType)) {
      chartType = ChartType.LINE;
    }

    const groupBys: string[] = parsed.groupBys ?? [];
    const fields: string[] = getFieldsForConstructedQuery(yAxes);

    const parsedSortBys = decodeSorts(parsed.sortBys);
    const sortBys = validateSortBys(parsedSortBys, groupBys, fields, yAxes);

    return {
      yAxes,
      chartType,
      sortBys,
      query: parsed.query ?? '',
      groupBys,
      fields,
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

export type WritableExploreQueryParts = {
  chartType?: ChartType;
  fields?: string[];
  groupBys?: string[];
  query?: string;
  sortBys?: Sort[];
  yAxes?: string[];
};

function getUpdatedLocationWithQueries(
  location: Location,
  queries: WritableExploreQueryParts[] | null | undefined
) {
  const target = {...location};
  if (defined(queries)) {
    target.query.queries = queries.map(query =>
      JSON.stringify({
        chartType: query.chartType,
        fields: query.fields,
        groupBys: query.groupBys,
        query: query.query,
        sortBys: query.sortBys?.map(encodeSort),
        yAxes: query.yAxes,
      })
    );
  } else if (queries === null) {
    delete target.query.queries;
  }
  console.log('here');
  return target;
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
      const newQueries = [...queries];
      newQueries[index] = newQuery;

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

  return fields;
}

export function getQueryMode(groupBys?: string[]): Mode {
  return groupBys?.length === 0 ? Mode.SAMPLES : Mode.AGGREGATE;
}
