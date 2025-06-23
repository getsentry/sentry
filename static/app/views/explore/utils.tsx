import type {ReactNode} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';
import * as qs from 'query-string';

import {openConfirmModal} from 'sentry/components/confirm';
import type {SelectOptionWithKey} from 'sentry/components/core/compactSelect/types';
import HookOrDefault from 'sentry/components/hookOrDefault';
import {IconBusiness} from 'sentry/icons/iconBusiness';
import {t} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import type {TagCollection} from 'sentry/types/group';
import type {Confidence, Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import {encodeSort} from 'sentry/utils/discover/eventView';
import type {Sort} from 'sentry/utils/discover/fields';
import {parseFunction} from 'sentry/utils/discover/fields';
import {decodeSorts} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {determineSeriesSampleCountAndIsSampled} from 'sentry/views/alerts/rules/metric/utils/determineSeriesSampleCount';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
import {newExploreTarget} from 'sentry/views/explore/contexts/pageParamsContext';
import type {GroupBy} from 'sentry/views/explore/contexts/pageParamsContext/aggregateFields';
import {isGroupBy} from 'sentry/views/explore/contexts/pageParamsContext/aggregateFields';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import type {
  BaseVisualize,
  Visualize,
} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import type {
  RawGroupBy,
  RawVisualize,
  SavedQuery,
} from 'sentry/views/explore/hooks/useGetSavedQueries';
import {isRawVisualize} from 'sentry/views/explore/hooks/useGetSavedQueries';
import type {ReadableExploreQueryParts} from 'sentry/views/explore/multiQueryMode/locationUtils';
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
  title,
  referrer,
}: {
  organization: Organization;
  aggregateField?: Array<GroupBy | BaseVisualize>;
  field?: string[];
  groupBy?: string[];
  id?: number;
  interval?: string;
  mode?: Mode;
  query?: string;
  referrer?: string;
  selection?: PageFilters;
  sort?: string;
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
    title,
    referrer,
  };

  return (
    makeTracesPathname({
      organization,
      path: '/',
    }) + `?${qs.stringify(queryParams, {skipNull: true})}`
  );
}

export function getExploreUrlFromSavedQueryUrl({
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
}: {
  interval: string;
  organization: Organization;
  queries: ReadableExploreQueryParts[];
  selection: PageFilters;
  id?: number;
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
    queries: queries.map(({chartType, fields, groupBys, query, sortBys, yAxes}) =>
      JSON.stringify({
        chartType,
        fields,
        groupBys,
        query,
        sortBys: sortBys[0] ? encodeSort(sortBys[0]) : undefined, // Explore only handles a single sort by
        yAxes,
      })
    ),
    title,
    id,
    utc,
  };

  return `/organizations/${organization.slug}/explore/traces/compare/?${qs.stringify(queryParams, {skipNull: true})}`;
}

export function combineConfidenceForSeries(
  series: Array<Pick<TimeSeries, 'confidence'>>
): Confidence {
  let lows = 0;
  let highs = 0;
  let nulls = 0;

  for (const s of series) {
    if (s.confidence === 'low') {
      lows += 1;
    } else if (s.confidence === 'high') {
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

export function viewSamplesTarget({
  location,
  query,
  groupBys,
  visualizes,
  sorts,
  row,
  projects,
}: {
  groupBys: string[];
  location: Location;
  // needed to generate targets when `project` is in the group by
  projects: Project[];
  query: string;
  row: Record<string, any>;
  sorts: Sort[];
  visualizes: Visualize[];
}) {
  const search = new MutableSearch(query);

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
      search.setFilterValues(groupBy, [value]);
    }
  }

  // all group bys will be used as columns
  const fields = groupBys.filter(Boolean);
  const seenFields = new Set(fields);

  // add all the arguments of the visualizations as columns
  for (const visualize of visualizes) {
    const parsedFunction = parseFunction(visualize.yAxis);
    if (!parsedFunction?.arguments[0]) {
      continue;
    }
    const field = parsedFunction.arguments[0];
    if (seenFields.has(field)) {
      continue;
    }
    fields.push(field);
    seenFields.add(field);
  }

  // fall back, force timestamp to be a column so we
  // always have at least 1 column
  if (fields.length === 0) {
    fields.push('timestamp');
    seenFields.add('timestamp');
  }

  // fall back, sort the last column present
  let sortBy: Sort = {
    field: fields[fields.length - 1]!,
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
      fields.push(field);
    }

    sortBy = {
      field,
      kind: sort.kind,
    };
    break;
  }

  return newExploreTarget(location, {
    mode: Mode.SAMPLES,
    fields,
    query: search.formatString(),
    sortBys: [sortBy],
  });
}

type MaxPickableDays = 7 | 14 | 30;
type DefaultPeriod = '24h' | '7d' | '14d' | '30d';

export interface PickableDays {
  defaultPeriod: DefaultPeriod;
  maxPickableDays: MaxPickableDays;
  relativeOptions: ({
    arbitraryOptions,
  }: {
    arbitraryOptions: Record<string, ReactNode>;
  }) => Record<string, ReactNode>;
  isOptionDisabled?: ({value}: SelectOptionWithKey<string>) => boolean;
  menuFooter?: ReactNode;
}

export function limitMaxPickableDays(organization: Organization): PickableDays {
  const defaultPeriods: Record<MaxPickableDays, DefaultPeriod> = {
    7: '7d',
    14: '14d',
    30: '30d',
  };

  const relativeOptions: Array<[DefaultPeriod, ReactNode]> = [
    ['7d', t('Last 7 days')],
    ['14d', t('Last 14 days')],
    ['30d', t('Last 30 days')],
  ];

  const maxPickableDays: MaxPickableDays = organization.features.includes(
    'visibility-explore-range-high'
  )
    ? 30
    : organization.features.includes('visibility-explore-range-medium')
      ? 14
      : 7;
  const defaultPeriod: DefaultPeriod = defaultPeriods[maxPickableDays];

  const index = relativeOptions.findIndex(([period, _]) => period === defaultPeriod) + 1;
  const enabledOptions = Object.fromEntries(relativeOptions.slice(0, index));
  const disabledOptions = Object.fromEntries(
    relativeOptions.slice(index).map(([value, label]) => {
      return [value, <DisabledDateOption key={value} label={label} />];
    })
  );

  const isOptionDisabled = (option: SelectOptionWithKey<string>): boolean => {
    return disabledOptions.hasOwnProperty(option.value);
  };

  const menuFooter = index === relativeOptions.length ? null : <UpsellFooterHook />;

  return {
    defaultPeriod,
    isOptionDisabled,
    maxPickableDays,
    menuFooter,
    relativeOptions: ({
      arbitraryOptions,
    }: {
      arbitraryOptions: Record<string, ReactNode>;
    }) => ({
      ...arbitraryOptions,
      '1h': t('Last hour'),
      '24h': t('Last 24 hours'),
      ...enabledOptions,
      ...disabledOptions,
    }),
  };
}

export function getDefaultExploreRoute(organization: Organization) {
  if (organization.features.includes('performance-trace-explorer')) {
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
  visualizes: Visualize[],
  data: ReturnType<typeof useSortedTimeSeries>['data'],
  isTopN: boolean
) {
  return visualizes.map(visualize => {
    const dedupedYAxes = [visualize.yAxis];
    const series = dedupedYAxes.flatMap(yAxis => data[yAxis]).filter(defined);
    const {sampleCount} = determineSeriesSampleCountAndIsSampled(series, isTopN);
    return sampleCount;
  });
}

function DisabledDateOption({label}: {label: ReactNode}) {
  return (
    <DisabledDateOptionContainer>
      {label}
      <StyledIconBuisness />
    </DisabledDateOptionContainer>
  );
}

const DisabledDateOptionContainer = styled('div')`
  display: flex;
  align-items: center;
`;

const StyledIconBuisness = styled(IconBusiness)`
  margin-left: auto;
`;

const UpsellFooterHook = HookOrDefault({
  hookName: 'component:explore-date-range-query-limit-footer',
  defaultComponent: () => undefined,
});

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
      ? attributes.stringAttributes.hasOwnProperty(key.slice(1))
      : attributes.stringAttributes.hasOwnProperty(key);
    const isNumberAttribute = key.startsWith('!')
      ? attributes.numberAttributes.hasOwnProperty(key.slice(1))
      : attributes.numberAttributes.hasOwnProperty(key);

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
  if (attributes.numberAttributes.hasOwnProperty(key)) {
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

export function formatQueryToNaturalLanguage(query: string): string {
  if (!query.trim()) return '';
  const tokens = query.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
  const formattedTokens = tokens.map(formatToken);

  return formattedTokens.reduce((result, token, index) => {
    if (index === 0) return token;

    const prevToken = formattedTokens[index - 1];
    if (!prevToken) return `${result}, ${token}`;

    const isLogicalOp = token.toUpperCase() === 'AND' || token.toUpperCase() === 'OR';
    const prevIsLogicalOp =
      prevToken.toUpperCase() === 'AND' || prevToken.toUpperCase() === 'OR';

    if (isLogicalOp || prevIsLogicalOp) {
      return `${result} ${token}`;
    }

    return `${result}, ${token}`;
  }, '');
}

function formatToken(token: string): string {
  const isNegated = token.startsWith('!') && token.includes(':');
  const actualToken = isNegated ? token.slice(1) : token;

  const operators = [
    [':>=', 'greater than or equal to'],
    [':<=', 'less than or equal to'],
    [':!=', 'not'],
    [':>', 'greater than'],
    [':<', 'less than'],
    ['>=', 'greater than or equal to'],
    ['<=', 'less than or equal to'],
    ['!=', 'not'],
    ['!:', 'not'],
    ['>', 'greater than'],
    ['<', 'less than'],
    [':', ''],
  ] as const;

  for (const [op, desc] of operators) {
    if (actualToken.includes(op)) {
      const [key, value] = actualToken.split(op);
      const cleanKey = key?.trim() || '';
      const cleanVal = value?.trim() || '';

      const negation = isNegated ? 'not ' : '';
      const description = desc ? `${negation}${desc}` : negation ? 'not' : '';

      return `${cleanKey} is ${description} ${cleanVal}`.replace(/\s+/g, ' ').trim();
    }
  }

  return token;
}
