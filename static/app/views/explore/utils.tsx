import * as Sentry from '@sentry/react';
import type {Location} from 'history';
import * as qs from 'query-string';

import {Expression} from 'sentry/components/arithmeticBuilder/expression';
import {isTokenFunction} from 'sentry/components/arithmeticBuilder/token';
import {openConfirmModal} from 'sentry/components/confirm';
import {getTooltipText as getAnnotatedTooltipText} from 'sentry/components/events/meta/annotatedText/utils';
import type {CaseInsensitive} from 'sentry/components/searchQueryBuilder/hooks';
import {t} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import type {Tag, TagCollection} from 'sentry/types/group';
import type {Confidence, Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {defined, escapeDoubleQuotes} from 'sentry/utils';
import {encodeSort} from 'sentry/utils/discover/eventView';
import type {Sort} from 'sentry/utils/discover/fields';
import {
  isEquation,
  parseFunction,
  prettifyParsedFunction,
  stripEquationPrefix,
} from 'sentry/utils/discover/fields';
import {decodeSorts} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {determineTimeSeriesConfidence} from 'sentry/views/alerts/rules/metric/utils/determineSeriesConfidence';
import {determineSeriesSampleCountAndIsSampled} from 'sentry/views/alerts/rules/metric/utils/determineSeriesSampleCount';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
import type {GroupBy} from 'sentry/views/explore/contexts/pageParamsContext/aggregateFields';
import {isGroupBy} from 'sentry/views/explore/contexts/pageParamsContext/aggregateFields';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import type {BaseVisualize} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import type {
  RawGroupBy,
  RawVisualize,
  SavedQuery,
} from 'sentry/views/explore/hooks/useGetSavedQueries';
import {
  getSavedQueryTraceItemDataset,
  isRawVisualize,
} from 'sentry/views/explore/hooks/useGetSavedQueries';
import type {
  TraceItemAttributeMeta,
  TraceItemDetailsMeta,
} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {getLogsUrlFromSavedQueryUrl} from 'sentry/views/explore/logs/utils';
import {getMetricsUrlFromSavedQueryUrl} from 'sentry/views/explore/metrics/utils';
import type {ReadableExploreQueryParts} from 'sentry/views/explore/multiQueryMode/locationUtils';
import type {Visualize} from 'sentry/views/explore/queryParams/visualize';
import {getTargetWithReadableQueryParams} from 'sentry/views/explore/spans/spansQueryParams';
import {TraceItemDataset} from 'sentry/views/explore/types';
import type {ChartType} from 'sentry/views/insights/common/components/chart';
import {isChartType} from 'sentry/views/insights/common/components/chart';
import type {useSortedTimeSeries} from 'sentry/views/insights/common/queries/useSortedTimeSeries';
import {makeTracesPathname} from 'sentry/views/traces/pathnames';

export function getExploreUrl({
  organization,
  selection,
  interval,
  mode,
  aggregateField,
  visualize,
  query,
  groupBy,
  sort,
  field,
  id,
  table,
  title,
  referrer,
  caseInsensitive,
}: {
  organization: Organization;
  aggregateField?: Array<GroupBy | BaseVisualize>;
  caseInsensitive?: CaseInsensitive;
  field?: string[];
  groupBy?: string[];
  id?: number;
  interval?: string;
  mode?: Mode;
  query?: string;
  referrer?: string;
  selection?: PageFilters;
  sort?: string;
  table?: string;
  title?: string;
  visualize?: BaseVisualize[];
}) {
  const {start, end, period: statsPeriod, utc} = selection?.datetime ?? {};
  const {environments, projects} = selection ?? {};
  const queryParams = {
    project: projects,
    environment: environments,
    statsPeriod,
    start,
    end,
    interval,
    mode,
    query,
    aggregateField: aggregateField?.map(v => JSON.stringify(v)),
    visualize: visualize?.map(v => JSON.stringify(v)),
    groupBy,
    sort,
    field,
    utc,
    id,
    table,
    title,
    referrer,
    caseInsensitive: caseInsensitive ? '1' : undefined,
  };

  return (
    makeTracesPathname({
      organization,
      path: '/',
    }) + `?${qs.stringify(queryParams, {skipNull: true})}`
  );
}

function getExploreUrlFromSavedQueryUrl({
  savedQuery,
  organization,
}: {
  organization: Organization;
  savedQuery: SavedQuery;
}) {
  if (savedQuery.query.length > 1) {
    return getExploreMultiQueryUrl({
      organization,
      ...savedQuery,
      queries: savedQuery.query.map(q => {
        const groupBys: string[] | undefined =
          q.aggregateField
            ?.filter<RawGroupBy>(isGroupBy)
            ?.map(groupBy => groupBy.groupBy) ?? q.groupby;
        const visualize: RawVisualize | undefined =
          q.aggregateField?.find<RawVisualize>(isRawVisualize) ?? q.visualize?.[0];
        const chartType: ChartType | undefined = isChartType(visualize?.chartType)
          ? visualize.chartType
          : undefined;

        return {
          ...q,
          chartType,
          yAxes: (visualize?.yAxes ?? []).slice(),
          groupBys: groupBys ?? [],
          sortBys: decodeSorts(q.orderby),
          caseInsensitive: q.caseInsensitive ? '1' : null,
        };
      }),
      title: savedQuery.name,
      selection: {
        datetime: {
          end: savedQuery.end ?? null,
          period: savedQuery.range ?? null,
          start: savedQuery.start ?? null,
          utc: null,
        },
        environments: savedQuery.environment ?? [],
        projects: savedQuery.projects,
      },
    });
  }

  return getExploreUrl({
    organization,
    ...savedQuery,
    ...savedQuery.query[0],
    groupBy:
      (savedQuery.query[0].groupby?.length ?? 0) === 0
        ? ['']
        : savedQuery.query[0].groupby,
    sort: savedQuery.query[0].orderby,
    query: savedQuery.query[0].query,
    title: savedQuery.name,
    mode: savedQuery.query[0].mode,
    field: savedQuery.query[0].fields,
    selection: {
      datetime: {
        end: savedQuery.end ?? null,
        period: savedQuery.range ?? null,
        start: savedQuery.start ?? null,
        utc: null,
      },
      environments: savedQuery.environment ?? [],
      projects: savedQuery.projects,
    },
  });
}

export function getExploreMultiQueryUrl({
  organization,
  selection,
  interval,
  queries,
  title,
  id,
  referrer,
}: {
  interval: string;
  organization: Organization;
  queries: ReadableExploreQueryParts[];
  selection: PageFilters;
  id?: number;
  referrer?: string;
  title?: string;
}) {
  const {start, end, period: statsPeriod, utc} = selection.datetime;
  const {environments, projects} = selection;
  const queryParams = {
    project: projects,
    environment: environments,
    statsPeriod,
    start,
    end,
    interval,
    queries: queries.map(
      ({chartType, fields, groupBys, query, sortBys, yAxes, caseInsensitive}) =>
        JSON.stringify({
          chartType,
          fields,
          groupBys,
          query,
          sortBys: sortBys[0] ? encodeSort(sortBys[0]) : undefined, // Explore only handles a single sort by
          yAxes,
          caseInsensitive: caseInsensitive ? '1' : undefined,
        })
    ),
    title,
    id,
    utc,
    referrer,
  };

  return `/organizations/${organization.slug}/explore/traces/compare/?${qs.stringify(queryParams, {skipNull: true})}`;
}

export function combineConfidenceForSeries(series: TimeSeries[]): Confidence {
  let lows = 0;
  let highs = 0;
  let nulls = 0;

  for (const s of series) {
    const confidence = determineTimeSeriesConfidence(s);
    if (confidence === 'low') {
      lows += 1;
    } else if (confidence === 'high') {
      highs += 1;
    } else {
      nulls += 1;
    }
  }

  if (lows <= 0 && highs <= 0 && nulls >= 0) {
    return null;
  }

  if (lows / (lows + highs) > 0.5) {
    return 'low';
  }

  return 'high';
}

export function generateTargetQuery({
  fields,
  groupBys,
  location,
  projects,
  search,
  row,
  sorts,
  yAxes,
}: {
  fields: readonly string[];
  groupBys: readonly string[];
  location: Location;
  // needed to generate targets when `project` is in the group by
  projects: Project[];
  row: Record<string, any>;
  search: MutableSearch;
  sorts: readonly Sort[];
  yAxes: string[];
}) {
  search = search.copy();

  // first update the resulting query to filter for the target group
  for (const groupBy of groupBys) {
    const value = row[groupBy];
    // some fields require special handling so make sure to handle it here
    if (groupBy === 'project' && typeof value === 'string') {
      const project = projects.find(p => p.slug === value);
      if (defined(project)) {
        location.query.project = project.id;
      }
    } else if (groupBy === 'project.id' && typeof value === 'number') {
      location.query.project = String(value);
    } else if (groupBy === 'environment' && typeof value === 'string') {
      location.query.environment = value;
    } else if (typeof value === 'string') {
      // TODO(nsdeschenes): Remove this once we have a proper way to handle quoted values
      // that have square brackets included in the value
      if (value.startsWith('[') && value.endsWith(']')) {
        search.setFilterValues(groupBy, [`"${escapeDoubleQuotes(value)}"`]);
      } else {
        search.setFilterValues(groupBy, [value]);
      }
    }
  }

  const newFields = [...fields];
  const seenFields = new Set(newFields);

  // add all the arguments of the visualizations as columns
  for (const yAxis of yAxes) {
    const parsedFunction = parseFunction(yAxis);
    if (!parsedFunction?.arguments[0]) {
      continue;
    }
    const field = parsedFunction.arguments[0];
    if (seenFields.has(field)) {
      continue;
    }
    newFields.push(field);
    seenFields.add(field);
  }

  // fall back, force timestamp to be a column so we
  // always have at least 1 column
  if (newFields.length === 0) {
    newFields.push('timestamp');
    seenFields.add('timestamp');
  }

  // fall back, sort the last column present
  let sortBy: Sort = {
    field: newFields[newFields.length - 1]!,
    kind: 'desc' as const,
  };

  // find the first valid sort and sort on that
  for (const sort of sorts) {
    const parsedFunction = parseFunction(sort.field);
    if (!parsedFunction?.arguments[0]) {
      continue;
    }
    const field = parsedFunction.arguments[0];

    // on the odd chance that this sorted column was not added
    // already, make sure to add it
    if (!seenFields.has(field)) {
      newFields.push(field);
    }

    sortBy = {
      field,
      kind: sort.kind,
    };
    break;
  }

  return {
    fields: newFields,
    search,
    sortBys: [sortBy],
  };
}

export function viewSamplesTarget({
  location,
  query,
  fields,
  groupBys,
  visualizes,
  sorts,
  row,
  projects,
}: {
  fields: readonly string[];
  groupBys: readonly string[];
  location: Location;
  // needed to generate targets when `project` is in the group by
  projects: Project[];
  query: string;
  row: Record<string, any>;
  sorts: readonly Sort[];
  visualizes: readonly Visualize[];
}) {
  const search = new MutableSearch(query);

  const {
    fields: newFields,
    search: newSearch,
    sortBys: newSortBys,
  } = generateTargetQuery({
    fields,
    groupBys,
    location,
    projects,
    search,
    row,
    sorts,
    yAxes: visualizes.map(visualize => visualize.yAxis),
  });

  return getTargetWithReadableQueryParams(location, {
    mode: Mode.SAMPLES,
    fields: newFields,
    query: newSearch.formatString(),
    sortBys: newSortBys,
  });
}

export function getDefaultExploreRoute(organization: Organization) {
  if (
    organization.features.includes('performance-trace-explorer') ||
    organization.features.includes('visibility-explore-view')
  ) {
    return 'traces';
  }

  if (organization.features.includes('ourlogs-enabled')) {
    return 'logs';
  }

  if (organization.features.includes('discover-basic')) {
    return 'discover/homepage';
  }

  if (organization.features.includes('performance-profiling')) {
    return 'profiling';
  }

  if (organization.features.includes('session-replay-ui')) {
    return 'replays';
  }

  return 'releases';
}

export function computeVisualizeSampleTotals(
  yAxes: string[],
  data: ReturnType<typeof useSortedTimeSeries>['data'],
  isTopN: boolean
) {
  return yAxes.map(yAxis => {
    const series = data?.[yAxis]?.filter(defined) ?? [];
    const {sampleCount} = determineSeriesSampleCountAndIsSampled(series, isTopN);
    return sampleCount;
  });
}

export function confirmDeleteSavedQuery({
  handleDelete,
  savedQuery,
}: {
  handleDelete: () => void;
  savedQuery: SavedQuery;
}) {
  openConfirmModal({
    message: t('Are you sure you want to delete the query "%s"?', savedQuery.name),
    isDangerous: true,
    confirmText: t('Delete Query'),
    priority: 'danger',
    onConfirm: handleDelete,
  });
}

export function findSuggestedColumns(
  newSearch: MutableSearch,
  oldSearch: MutableSearch,
  attributes: {
    numberAttributes: TagCollection;
    stringAttributes: TagCollection;
  }
): string[] {
  const oldFilters = oldSearch.filters;
  const newFilters = newSearch.filters;

  const keys: Set<string> = new Set();

  for (const [key, value] of Object.entries(newFilters)) {
    if (key === 'has' || key === '!has') {
      // special key to be handled last
      continue;
    }

    const isStringAttribute = key.startsWith('!')
      ? key.slice(1) in attributes.stringAttributes
      : key in attributes.stringAttributes;
    const isNumberAttribute = key.startsWith('!')
      ? key.slice(1) in attributes.numberAttributes
      : key in attributes.numberAttributes;

    // guard against unknown keys and aggregate keys
    if (!isStringAttribute && !isNumberAttribute) {
      continue;
    }

    if (isSimpleFilter(key, value, attributes)) {
      continue;
    }

    if (
      !oldFilters.hasOwnProperty(key) || // new filter key
      isSimpleFilter(key, oldFilters[key] || [], attributes) // existing filter key turned complex
    ) {
      keys.add(normalizeKey(key));
      break;
    }
  }

  const oldHas = new Set(oldFilters.has);
  for (const key of newFilters.has || []) {
    if (oldFilters.hasOwnProperty(key) || oldHas.has(key)) {
      // old condition, don't add column
      continue;
    }

    // if there's a simple filter on the key, don't add column
    if (
      newFilters.hasOwnProperty(key) &&
      isSimpleFilter(key, newFilters[key] || [], attributes)
    ) {
      continue;
    }

    keys.add(normalizeKey(key));
  }

  return [...keys];
}

const PREFIX_WILDCARD_PATTERN = /^(\\\\)*\*/;
const INFIX_WILDCARD_PATTERN = /[^\\](\\\\)*\*/;

function isSimpleFilter(
  key: string,
  value: string[],
  attributes: {
    numberAttributes: TagCollection;
    stringAttributes: TagCollection;
  }
): boolean {
  // negation filters are always considered non trivial
  // because it matches on multiple values
  if (key.startsWith('!')) {
    return false;
  }

  // all number attributes are considered non trivial because they
  // almost always match on a range of values
  if (key in attributes.numberAttributes) {
    return false;
  }

  if (value.length === 1) {
    const v = value[0]!;
    // if the value is wrapped in `[...]`, then it's an array value
    if (v.startsWith('[') && v.endsWith(']')) {
      return false;
    }

    // if is wild card search, return false
    if (v.startsWith('*')) {
      return false;
    }

    if (PREFIX_WILDCARD_PATTERN.test(v) || INFIX_WILDCARD_PATTERN.test(v)) {
      return false;
    }
  }

  // if there is more than 1 possible value
  if (value.length > 1) {
    return false;
  }

  return true;
}

function normalizeKey(key: string): string {
  return key.startsWith('!') ? key.slice(1) : key;
}

export function prettifyAggregation(aggregation: string): string | null {
  if (isEquation(aggregation)) {
    const expression = new Expression(stripEquationPrefix(aggregation));
    return expression.tokens
      .map(token => {
        if (isTokenFunction(token)) {
          const func = parseFunction(token.text);
          if (func) {
            return prettifyParsedFunction(func);
          }
        }
        return token.text;
      })
      .join(' ');
  }

  const func = parseFunction(aggregation);
  if (func) {
    return prettifyParsedFunction(func);
  }

  return null;
}

export const removeHiddenKeys = (
  tagCollection: TagCollection,
  hiddenKeys: string[]
): TagCollection => {
  const result: TagCollection = {};
  for (const key in tagCollection) {
    if (key && !hiddenKeys.includes(key) && tagCollection[key]) {
      result[key] = tagCollection[key];
    }
  }
  return result;
};

export const onlyShowKeys = (tagCollection: Tag[], keys: string[]): Tag[] => {
  const result: Tag[] = [];
  tagCollection.forEach(tag => {
    if (keys.includes(tag.key) && tag.name) {
      result.push(tag);
    }
  });
  return result;
};

export function getSavedQueryTraceItemUrl({
  savedQuery,
  organization,
}: {
  organization: Organization;
  savedQuery: SavedQuery;
}) {
  const traceItemDataset = getSavedQueryTraceItemDataset(savedQuery.dataset);
  const urlFunction = TRACE_ITEM_TO_URL_FUNCTION[traceItemDataset];
  if (urlFunction) {
    return urlFunction({savedQuery, organization});
  }
  // Invariant, only spans, logs, and metrics are currently supported.
  Sentry.captureMessage(
    `Saved query ${savedQuery.id} has an invalid dataset: ${savedQuery.dataset}`
  );
  return getExploreUrlFromSavedQueryUrl({savedQuery, organization});
}

const TRACE_ITEM_TO_URL_FUNCTION: Record<
  TraceItemDataset,
  | (({
      savedQuery,
      organization,
    }: {
      organization: Organization;
      savedQuery: SavedQuery;
    }) => string)
  | undefined
> = {
  [TraceItemDataset.LOGS]: getLogsUrlFromSavedQueryUrl,
  [TraceItemDataset.SPANS]: getExploreUrlFromSavedQueryUrl,
  [TraceItemDataset.UPTIME_RESULTS]: undefined,
  [TraceItemDataset.TRACEMETRICS]: getMetricsUrlFromSavedQueryUrl,
};

/**
 * Metadata about trace item attributes.
 *
 * This can be used to extract additional information about attributes
 * like remarks (e.g. why a value was redacted).
 */
export class TraceItemMetaInfo {
  private static readonly META_PATH_CURRENT = '';

  private meta: TraceItemDetailsMeta;

  constructor(meta: TraceItemDetailsMeta) {
    this.meta = meta;
  }

  getAttributeMeta(attribute: string): TraceItemAttributeMeta | undefined {
    return this.meta?.[attribute]?.meta?.value?.[TraceItemMetaInfo.META_PATH_CURRENT];
  }

  getRemarks(attribute: string): RemarkObject[] {
    const attributeMeta = this.getAttributeMeta(attribute);
    if (!attributeMeta?.rem?.length) {
      return [];
    }

    const properlyFormedRemarks = attributeMeta.rem.filter(r => r.length >= 2); // Defensive against unexpected length remarks.

    return properlyFormedRemarks.map((rem): RemarkObject => {
      const [ruleId, type, rangeStart, rangeEnd] = rem;
      return {
        ruleId: String(ruleId),
        type: String(type),
        rangeStart: Number(rangeStart),
        rangeEnd: Number(rangeEnd),
      };
    });
  }

  hasRemarks(attribute: string): boolean {
    const attributeMeta = this.getAttributeMeta(attribute);
    return (attributeMeta?.rem?.length ?? 0) > 0;
  }

  static getTooltipText(
    attribute: string,
    meta: TraceItemDetailsMeta,
    organization?: Organization,
    project?: Project
  ): string | React.ReactNode | null {
    const metaInfo = new TraceItemMetaInfo(meta);
    const remarks = metaInfo.getRemarks(attribute);

    const firstRemark = remarks[0];
    if (!firstRemark) {
      return null;
    }

    return getAnnotatedTooltipText({
      remark: firstRemark.type,
      rule_id: firstRemark.ruleId,
      organization,
      project,
    });
  }
}

interface RemarkObject {
  rangeEnd: number;
  rangeStart: number;
  ruleId: string;
  type: string;
}
