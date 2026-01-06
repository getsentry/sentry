import * as Sentry from '@sentry/react';
import type {Location} from 'history';
import * as qs from 'query-string';

import type {ApiResult} from 'sentry/api';
import {t} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import type {Event} from 'sentry/types/event';
import type {TagCollection} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import type {EventsMetaType} from 'sentry/utils/discover/eventView';
import {
  CurrencyUnit,
  DurationUnit,
  fieldAlignment,
  type Sort,
} from 'sentry/utils/discover/fields';
import parseLinkHeader from 'sentry/utils/parseLinkHeader';
import type {InfiniteData, InfiniteQueryObserverResult} from 'sentry/utils/queryClient';
import type {MutableSearch} from 'sentry/utils/tokenizeSearch';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {prettifyAttributeName} from 'sentry/views/explore/components/traceItemAttributes/utils';
import {
  LOGS_AGGREGATE_FN_KEY,
  LOGS_AGGREGATE_PARAM_KEY,
  LOGS_FIELDS_KEY,
  LOGS_GROUP_BY_KEY,
  LOGS_QUERY_KEY,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {LOGS_SORT_BYS_KEY} from 'sentry/views/explore/contexts/logs/sortBys';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {SavedQuery} from 'sentry/views/explore/hooks/useGetSavedQueries';
import type {
  TraceItemDetailsResponse,
  TraceItemResponseAttribute,
} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {
  DeprecatedLogDetailFields,
  LogAttributesHumanLabel,
  LOGS_GRID_SCROLL_MIN_ITEM_THRESHOLD,
} from 'sentry/views/explore/logs/constants';
import {
  getTargetWithReadableQueryParams,
  LOGS_AGGREGATE_FIELD_KEY,
} from 'sentry/views/explore/logs/logsQueryParams';
import {
  OurLogKnownFieldKey,
  type EventsLogsResult,
  type LogAttributeUnits,
  type LogRowItem,
  type OurLogFieldKey,
  type OurLogsResponseItem,
} from 'sentry/views/explore/logs/types';
import type {GroupBy} from 'sentry/views/explore/queryParams/groupBy';
import {
  type BaseVisualize,
  type Visualize,
} from 'sentry/views/explore/queryParams/visualize';
import {generateTargetQuery} from 'sentry/views/explore/utils';
import type {useSortedTimeSeries} from 'sentry/views/insights/common/queries/useSortedTimeSeries';

const {warn, fmt} = Sentry.logger;

export function getLogSeverityLevel(
  severityNumber: number | null,
  severityText: string | null
): SeverityLevel {
  // Defer to the severity number if it is provided
  // Currently follows https://opentelemetry.io/docs/specs/otel/logs/data-model/#field-severitynumber
  if (severityNumber) {
    if (severityNumber >= 1 && severityNumber <= 4) {
      return SeverityLevel.TRACE;
    }
    if (severityNumber >= 5 && severityNumber <= 8) {
      return SeverityLevel.DEBUG;
    }
    if (severityNumber >= 9 && severityNumber <= 12) {
      return SeverityLevel.INFO;
    }
    if (severityNumber >= 13 && severityNumber <= 16) {
      return SeverityLevel.WARN;
    }
    if (severityNumber >= 17 && severityNumber <= 20) {
      return SeverityLevel.ERROR;
    }
    if (severityNumber >= 21 && severityNumber <= 24) {
      return SeverityLevel.FATAL;
    }
  }

  // Otherwise use severity text if it's a case insensitive match for one of the severity levels
  if (severityText) {
    const upperText = severityText.toUpperCase();
    const validLevels = [
      SeverityLevel.TRACE,
      SeverityLevel.DEBUG,
      SeverityLevel.INFO,
      SeverityLevel.WARN,
      SeverityLevel.ERROR,
      SeverityLevel.FATAL,
      SeverityLevel.DEFAULT,
      SeverityLevel.UNKNOWN,
    ];
    if (validLevels.includes(upperText as SeverityLevel)) {
      return upperText as SeverityLevel;
    }
  }

  // If the severity number isn't in range or the severity text can't map to a level, the severity level is unknown.
  return SeverityLevel.UNKNOWN;
}

/**
 * This level is the source of truth for the severity level.
 * Currently overlaps with the OpenTelemetry log severity level, with the addition of DEFAULT and UNKNOWN.
 */
export enum SeverityLevel {
  // A fine-grained debugging event. Typically disabled in default configurations.
  TRACE = 'TRACE',
  // A debugging event.
  DEBUG = 'DEBUG',
  // An informational event. Indicates that an event happened.
  INFO = 'INFO',
  // A warning event. Not an error but is likely more important than an informational event.
  WARN = 'WARN',
  // An error event. Something went wrong.
  ERROR = 'ERROR',
  // A fatal error such as application or system crash.
  FATAL = 'FATAL',
  // The log entry has no assigned severity level.
  DEFAULT = 'DEFAULT',
  // Unknown severity level, no severity text or number provided.
  UNKNOWN = 'UNKNOWN',
}

/**
 * Maps all internal severity levels to the appropriate text level. Should all be 4 characters for display purposes.
 */
export function severityLevelToText(level: SeverityLevel) {
  return {
    [SeverityLevel.TRACE]: t('trace'),
    [SeverityLevel.DEBUG]: t('debug'),
    [SeverityLevel.INFO]: t('info'),
    [SeverityLevel.WARN]: t('warn'),
    [SeverityLevel.ERROR]: t('error'),
    [SeverityLevel.FATAL]: t('fatal'),
    [SeverityLevel.DEFAULT]: t('default'),
    [SeverityLevel.UNKNOWN]: t('unknown'), // Maps to info for now.
  }[level];
}

export function getLogBodySearchTerms(search: MutableSearch): string[] {
  const searchTerms: string[] = search.freeText.map(text => text.replaceAll('*', ''));
  const bodyFilters = search.getFilterValues('log.body');
  for (const filter of bodyFilters) {
    if (!filter.startsWith('!') && !filter.startsWith('[')) {
      searchTerms.push(filter);
    }
  }
  return searchTerms;
}

export function logsFieldAlignment(...args: Parameters<typeof fieldAlignment>) {
  const field = args[0];
  if (field === OurLogKnownFieldKey.TIMESTAMP) {
    return 'left';
  }
  return fieldAlignment(...args);
}

export function adjustAliases(attribute: TraceItemResponseAttribute) {
  switch (attribute.name) {
    case 'sentry.project_id':
      warn(
        fmt`Field ${attribute.name} is deprecated. Please use ${OurLogKnownFieldKey.PROJECT_ID} instead.`
      );
      return OurLogKnownFieldKey.PROJECT_ID; // Public alias since int<->string alias reversing is broken. Should be removed in the future.
    default:
      return attribute.name;
  }
}

export function getTableHeaderLabel(
  field: OurLogFieldKey,
  stringAttributes?: TagCollection,
  numberAttributes?: TagCollection
) {
  const attribute = stringAttributes?.[field] ?? numberAttributes?.[field] ?? null;

  return (
    LogAttributesHumanLabel[field] ?? attribute?.name ?? prettifyAttributeName(field)
  );
}

function isLogAttributeUnit(unit: string | null): unit is LogAttributeUnits {
  return (
    unit === null ||
    Object.values(DurationUnit).includes(unit as DurationUnit) ||
    Object.values(CurrencyUnit).includes(unit as CurrencyUnit) ||
    unit === 'count' ||
    unit === 'percentage' ||
    unit === 'percent_change'
  );
}

export function getLogRowItem(
  field: OurLogFieldKey,
  dataRow: OurLogsResponseItem,
  meta: EventsMetaType | undefined
): LogRowItem {
  if (!defined(dataRow[field])) {
    warn(fmt`Field ${field} in not defined in dataRow ${dataRow}`);
  }

  return {
    fieldKey: field,
    unit: isLogAttributeUnit(meta?.units?.[field] ?? null)
      ? (meta?.units?.[field] as LogAttributeUnits)
      : null,
    value: dataRow[field] ?? '',
  };
}

export function checkSortIsTimeBasedDescending(sortBys: readonly Sort[]) {
  return (
    getTimeBasedSortBy(sortBys) !== undefined &&
    sortBys.some(sortBy => sortBy.kind === 'desc')
  );
}

export function getTimeBasedSortBy(sortBys: readonly Sort[]) {
  return sortBys.find(
    sortBy =>
      sortBy.field === OurLogKnownFieldKey.TIMESTAMP ||
      sortBy.field === OurLogKnownFieldKey.TIMESTAMP_PRECISE
  );
}

export function adjustLogTraceID(traceID: string) {
  return traceID.replace(/-/g, '');
}

export function getDynamicLogsNextFetchThreshold(lastPageLength: number) {
  if (lastPageLength * 0.25 > LOGS_GRID_SCROLL_MIN_ITEM_THRESHOLD) {
    return Math.floor(lastPageLength * 0.25); // Can be up to 250 on large pages.
  }
  return LOGS_GRID_SCROLL_MIN_ITEM_THRESHOLD;
}

export function parseLinkHeaderFromLogsPage(
  page: InfiniteQueryObserverResult<InfiniteData<ApiResult<EventsLogsResult>>>
) {
  const linkHeader = page.data?.pages?.[0]?.[2]?.getResponseHeader('Link');
  return parseLinkHeader(linkHeader ?? null);
}

export function getLogRowTimestampMillis(row: OurLogsResponseItem): number {
  return Number(row[OurLogKnownFieldKey.TIMESTAMP_PRECISE]) / 1_000_000;
}

export function quantizeTimestampToMinutes(
  timestampMs: number,
  quantizeMinutes: number
): number {
  const quantizeMs = quantizeMinutes * 60 * 1000;
  return Math.floor(timestampMs / quantizeMs) * quantizeMs;
}

export function getLogTimestampBucketIndex(
  rowTimestampMillis: number,
  periodStartMillis: number,
  intervalMillis: number
): number {
  const relativeRowTimestamp = rowTimestampMillis - periodStartMillis;
  const bucketIndex = Math.floor(relativeRowTimestamp / intervalMillis);
  return bucketIndex;
}

// Null indicates the data is not available yet.
export function calculateAverageLogsPerSecond(
  timeseriesResult: ReturnType<typeof useSortedTimeSeries>
): number | null {
  if (timeseriesResult.isLoading) {
    return null;
  }

  if (!timeseriesResult?.data) {
    return 0;
  }

  const allSeries = Object.values(timeseriesResult.data)[0];
  if (!Array.isArray(allSeries) || allSeries.length === 0) {
    return 0;
  }

  let totalLogs = 0;
  let totalDurationSeconds = 0;

  allSeries.forEach(series => {
    if (!series?.values || !Array.isArray(series.values)) {
      return;
    }

    const values = series.values;
    if (values.length < 2) {
      return;
    }

    const seriesTotal = values.reduce((sum, item) => {
      return sum + (typeof item.value === 'number' ? item.value : 0);
    }, 0);

    totalLogs += seriesTotal;

    const firstTimestamp = values[0]?.timestamp;
    const lastTimestamp = values[values.length - 1]?.timestamp;

    if (firstTimestamp && lastTimestamp && lastTimestamp > firstTimestamp) {
      const durationMs = lastTimestamp - firstTimestamp;
      const durationSeconds = durationMs / 1000;
      totalDurationSeconds = Math.max(totalDurationSeconds, durationSeconds);
    }
  });

  if (totalDurationSeconds === 0) {
    return 0;
  }

  return totalLogs / totalDurationSeconds;
}

type BaseGetLogsUrlParams = {
  aggregateFields?: Array<GroupBy | BaseVisualize>;
  aggregateFn?: string;
  aggregateParam?: string;
  caseInsensitive?: '1' | null;
  field?: string[];
  groupBy?: string[];
  id?: number;
  interval?: string;
  mode?: Mode;
  query?: string;
  referrer?: string;
  selection?: PageFilters;
  sortBy?: string;
  title?: string;
};

export function getLogsUrl(
  params: BaseGetLogsUrlParams & {organization: Organization}
): string;
export function getLogsUrl(params: BaseGetLogsUrlParams & {organization: string}): string;
export function getLogsUrl({
  organization,
  selection,
  query,
  field,
  groupBy,
  id,
  interval,
  mode,
  referrer,
  sortBy,
  title,
  aggregateFields,
  aggregateFn,
  aggregateParam,
  caseInsensitive,
}: BaseGetLogsUrlParams & {organization: Organization | string}) {
  const {start, end, period: statsPeriod, utc} = selection?.datetime ?? {};
  const {environments, projects} = selection ?? {};
  const queryParams = {
    project: projects,
    environment: environments,
    statsPeriod,
    start,
    end,
    [LOGS_QUERY_KEY]: query,
    utc,
    [LOGS_FIELDS_KEY]: field,
    [LOGS_GROUP_BY_KEY]: groupBy,
    id,
    interval,
    mode,
    referrer,
    [LOGS_SORT_BYS_KEY]: sortBy,
    [LOGS_AGGREGATE_FIELD_KEY]: aggregateFields?.map(aggregateField =>
      JSON.stringify(aggregateField)
    ),
    [LOGS_AGGREGATE_FN_KEY]: aggregateFn,
    [LOGS_AGGREGATE_PARAM_KEY]: aggregateParam,
    title,
    caseInsensitive,
  };

  const orgSlug = typeof organization === 'string' ? organization : organization.slug;
  return (
    makeLogsPathname({organizationSlug: orgSlug, path: '/'}) +
    `?${qs.stringify(queryParams, {skipNull: true})}`
  );
}

export function makeLogsPathname({
  organizationSlug,
  path,
}: {
  organizationSlug: string;
  path: string;
}) {
  return normalizeUrl(`/organizations/${organizationSlug}/explore/logs${path}`);
}

export function getLogsUrlFromSavedQueryUrl({
  savedQuery,
  organization,
}: {
  organization: Organization;
  savedQuery: SavedQuery;
}) {
  const firstQuery = savedQuery.query[0];
  const visualize = firstQuery.visualize?.[0]?.yAxes?.[0];
  const aggregateFn = visualize ? visualize.split('(')[0] : undefined;
  const aggregateParam = visualize ? visualize.split('(')[1]?.split(')')[0] : undefined;

  return getLogsUrl({
    organization,
    field: firstQuery.fields,
    groupBy: defined(firstQuery.aggregateField) ? undefined : firstQuery.groupby,
    sortBy: firstQuery.orderby,
    title: savedQuery.name,
    id: savedQuery.id,
    interval: savedQuery.interval,
    mode: firstQuery.mode,
    query: firstQuery.query,
    aggregateFn: defined(firstQuery.aggregateField) ? undefined : aggregateFn,
    aggregateParam: defined(firstQuery.aggregateField) ? undefined : aggregateParam,
    aggregateFields: firstQuery.aggregateField,
    selection: {
      datetime: {
        end: savedQuery.end ?? null,
        period: savedQuery.range ?? null,
        start: savedQuery.start ?? null,
        utc: null,
      },
      environments: savedQuery.environment ? [...savedQuery.environment] : [],
      projects: savedQuery.projects ? [...savedQuery.projects] : [],
    },
    caseInsensitive: firstQuery.caseInsensitive ? '1' : null,
  });
}

export function ourlogToJson(ourlog: TraceItemDetailsResponse | undefined): string {
  if (!ourlog) {
    warn(fmt`cannot copy undefined ourlog`);
    return '';
  }

  const copy: Record<string, string | number | boolean> = {
    ...ourlog.attributes.reduce((it, {name, value}) => ({...it, [name]: value}), {}),
    id: ourlog.itemId,
  };
  let warned = false;
  const warnAttributeOnce = (key: string) => {
    if (!warned) {
      warned = true;
      warn(
        fmt`Found sentry. prefix in ${key} while copying [project_id: ${copy.project_id ?? 'unknown'}, user_email: ${copy['user.email'] ?? 'unknown'}]`
      );
    }
  };

  // Trimming any sentry. prefixes
  for (const key in copy) {
    if (DeprecatedLogDetailFields.includes(key)) {
      delete copy[key];
      continue;
    }
    if (key.startsWith('sentry.')) {
      const value = copy[key];
      if (value !== undefined) {
        warnAttributeOnce(key);
        delete copy[key];
        copy[key.replace('sentry.', '')] = value;
      }
    }
    if (key.startsWith('tags[sentry.')) {
      const value = copy[key];
      if (value !== undefined) {
        warnAttributeOnce(key);
        delete copy[key];
        copy[key.replace('tags[sentry.', 'tags[')] = value;
      }
    }
  }
  return JSON.stringify(copy, null, 2);
}

export function viewLogsSamplesTarget({
  location,
  search,
  fields,
  groupBys,
  visualizes,
  sorts,
  row,
  projects,
}: {
  fields: string[];
  groupBys: readonly string[];
  location: Location;
  // needed to generate targets when `project` is in the group by
  projects: Project[];
  row: Record<string, any>;
  search: MutableSearch;
  sorts: Sort[];
  visualizes: readonly Visualize[];
}) {
  const {
    fields: newFields,
    search: newSearch,
    sortBys: newSortBys,
  } = generateTargetQuery({
    fields,
    groupBys: groupBys.slice(),
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

export const logOnceFactory = (logSeverity: 'info' | 'warn') => {
  let fired = false;
  return (...args: Parameters<(typeof Sentry.logger)[typeof logSeverity]>) => {
    if (!fired) {
      fired = true;
      if (logSeverity === 'info') {
        return Sentry.logger.info(args[0], args[1]);
      }
      return Sentry.logger.warn(args[0], args[1]);
    }
    return () => {
      // Do nothing
    };
  };
};

interface PseudoLogResponseItem {
  [OurLogKnownFieldKey.ID]: string;
  [OurLogKnownFieldKey.MESSAGE]: string;
  [OurLogKnownFieldKey.SEVERITY]: 'ERROR';
  [OurLogKnownFieldKey.SEVERITY_NUMBER]: 17;
  [OurLogKnownFieldKey.TRACE_ID]: string;
  [OurLogKnownFieldKey.SPAN_ID]: string;
  [OurLogKnownFieldKey.ORGANIZATION_ID]: number;
  [OurLogKnownFieldKey.PROJECT_ID]: string;
  [OurLogKnownFieldKey.TIMESTAMP]: string;
  [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: string | number;
  __isPseudoRow: true;
  __originalEvent: Event;
}

export type LogTableRowItem = OurLogsResponseItem | PseudoLogResponseItem;

export function isPseudoLogResponseItem(
  item: LogTableRowItem
): item is PseudoLogResponseItem {
  return '__isPseudoRow' in item && item.__isPseudoRow === true;
}

export function isRegularLogResponseItem(
  item: LogTableRowItem
): item is OurLogsResponseItem {
  return !isPseudoLogResponseItem(item);
}

export function createPseudoLogResponseItem(
  event: Event,
  projectId: string
): PseudoLogResponseItem {
  const timestamp = event.dateCreated || new Date().toISOString();
  const timestampPrecise = new Date(timestamp).getTime() * 1_000_000;

  return {
    [OurLogKnownFieldKey.ID]: `pseudo-${event.eventID}`,
    [OurLogKnownFieldKey.MESSAGE]: event.title || event.message || 'Error Event',
    [OurLogKnownFieldKey.SEVERITY]: 'ERROR',
    [OurLogKnownFieldKey.SEVERITY_NUMBER]: 17,
    [OurLogKnownFieldKey.TRACE_ID]: event.contexts?.trace?.trace_id || '',
    [OurLogKnownFieldKey.SPAN_ID]: event.contexts?.trace?.span_id || '',
    [OurLogKnownFieldKey.PROJECT_ID]: projectId,
    [OurLogKnownFieldKey.TIMESTAMP]: timestamp,
    [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: timestampPrecise,
    // Observed timestamp can be added later if needed per the event received time.
    __isPseudoRow: true,
    __originalEvent: event,
  } as PseudoLogResponseItem;
}
