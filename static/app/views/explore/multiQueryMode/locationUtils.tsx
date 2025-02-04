import {useCallback} from 'react';
import type {Location} from 'history';

import {defined} from 'sentry/utils';
import {encodeSort} from 'sentry/utils/discover/eventView';
import {parseFunction, type Sort} from 'sentry/utils/discover/fields';
import {decodeList, decodeSorts} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {defaultSortBys} from 'sentry/views/explore/contexts/pageParamsContext/sortBys';
import {DEFAULT_VISUALIZATION} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
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
  sortBys: [{kind: 'desc', field: 'timestamp'}],
  fields: ['id', 'timestamp'],
  groupBys: [],
  query: '',
};

function validateSortBys(
  parsedSortBys: Sort[],
  groupBys?: string[],
  fields?: string[],
  yAxes?: string[]
): Sort[] {
  const mode =
    !defined(groupBys) || groupBys?.length === 0 ? Mode.SAMPLES : Mode.AGGREGATE;

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

    const yAxes = parsed.yAxes.filter(parseFunction);
    if (yAxes.length <= 0) {
      return DEFAULT_QUERY;
    }

    let chartType = Number(parsed.chartType);
    if (isNaN(chartType) || !Object.values(ChartType).includes(chartType)) {
      chartType = ChartType.LINE;
    }

    const fields: string[] = parsed.fields ?? [];
    const groupBys: string[] = parsed.groupBys ?? [];

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

function readQueriesFromLocation(location: Location): ReadableExploreQueryParts[] {
  const rawQueries = decodeList(location.query.queries);
  if (!defined(rawQueries) || rawQueries.length === 0) {
    return [DEFAULT_QUERY];
  }

  const parsedQueries = rawQueries.map(parseQuery);
  return parsedQueries;
}

export function useReadQueriesFromLocation() {
  const location = useLocation();
  return readQueriesFromLocation(location);
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
  if (defined(queries)) {
    location.query.queries = queries.map(query =>
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
    delete location.query.queries;
  }

  return location;
}

export function useUpdateQueryAtIndex() {
  const location = useLocation();
  const navigate = useNavigate();

  return useCallback(
    (index: number, updates: Partial<WritableExploreQueryParts>) => {
      const queries = readQueriesFromLocation(location);

      const queryToUpdate = queries[index];
      if (!queryToUpdate) {
        return;
      }

      const newQuery = {...queryToUpdate, ...updates};
      queries[index] = newQuery;

      const target = getUpdatedLocationWithQueries(location, queries);
      navigate(target);
    },
    [location, navigate]
  );
}

// Write utils end
