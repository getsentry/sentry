import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {useCaseInsensitivity} from 'sentry/components/searchQueryBuilder/hooks';
import {DataCategory} from 'sentry/types/core';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useLocation} from 'sentry/utils/useLocation';
import {useMaxPickableDays} from 'sentry/utils/useMaxPickableDays';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {
  AlwaysPresentLogFields,
  QUERY_PAGE_LIMIT,
  QUERY_PAGE_LIMIT_WITH_AUTO_REFRESH,
} from 'sentry/views/explore/logs/constants';
import {
  useLogsFrozenProjectIds,
  useLogsFrozenReplayInfo,
  useLogsFrozenSearch,
  useLogsFrozenTraceIds,
  useLogsFrozenTraceTimestamp,
} from 'sentry/views/explore/logs/logsFrozenContext';
import type {EventsLogsResult} from 'sentry/views/explore/logs/types';
import {useLogsQueryTruncate} from 'sentry/views/explore/logs/useLogsQueryTruncate';
import {
  useQueryParamsCursor,
  useQueryParamsFields,
  useQueryParamsGroupBys,
  useQueryParamsSearch,
  useQueryParamsSortBys,
} from 'sentry/views/explore/queryParams/context';
import {getEventView} from 'sentry/views/insights/common/queries/useDiscover';

const LOGS_DATA_CATEGORIES = [DataCategory.LOG_BYTE] as const;

function useLogsApiOptions({
  limit,
  referrer,
  highFidelity,
}: {
  referrer: string;
  highFidelity?: boolean;
  limit?: number;
}) {
  const organization = useOrganization();
  const _search = useQueryParamsSearch();
  const baseSearch = useLogsFrozenSearch();
  const cursor = useQueryParamsCursor();
  const _fields = useQueryParamsFields();
  const sortBys = useQueryParamsSortBys();
  const frozenTraceIds = useLogsFrozenTraceIds();
  const frozenTraceTimestamp = useLogsFrozenTraceTimestamp();
  const frozenReplayInfo = useLogsFrozenReplayInfo();
  const {maxPickableDays} = useMaxPickableDays({dataCategories: LOGS_DATA_CATEGORIES});
  const {selection, isReady: pageFiltersReady} = usePageFilters();
  const location = useLocation();
  const projectIds = useLogsFrozenProjectIds();
  const groupBys = useQueryParamsGroupBys();
  const [caseInsensitive] = useCaseInsensitivity();
  const truncate = useLogsQueryTruncate();

  const search = baseSearch ? _search.copy() : _search;
  if (baseSearch) {
    search.tokens.push(...baseSearch.tokens);
  }
  const fields = Array.from(
    new Set([...AlwaysPresentLogFields, ..._fields, ...groupBys.filter(Boolean)])
  );
  const sorts = sortBys ?? [];
  const pageFilters = selection;
  const dataset = DiscoverDatasets.OURLOGS;

  const eventView = getEventView(
    search,
    fields,
    sorts.slice(),
    pageFilters,
    dataset,
    projectIds ?? pageFilters.projects
  );

  const eventViewPayload = eventView.getEventsAPIPayload(location);

  if (frozenTraceTimestamp) {
    delete eventViewPayload.start;
    delete eventViewPayload.end;
    eventViewPayload.statsPeriod = `${maxPickableDays}d`;
  }

  if (frozenReplayInfo.replayId) {
    delete eventViewPayload.statsPeriod;
    eventViewPayload.start = frozenReplayInfo.replayStartedAt?.toISOString();
    eventViewPayload.end = frozenReplayInfo.replayEndedAt?.toISOString();
  }

  const orderby = eventViewPayload.sort;

  const baseQuery = {
    ...eventViewPayload,
    ...(frozenTraceIds ? {traceId: frozenTraceIds} : {}),
    ...(frozenTraceTimestamp ? {timestamp: frozenTraceTimestamp} : {}),
    ...(frozenReplayInfo.replayId ? {replayId: frozenReplayInfo.replayId} : {}),
    cursor,
    orderby,
    per_page: limit ? limit : undefined,
    referrer,
    sampling: highFidelity ? SAMPLING_MODE.FLEX_TIME : SAMPLING_MODE.NORMAL,
    caseInsensitive: caseInsensitive ? '1' : undefined,
    truncate,
  };

  const usesTraceLogsEndpoint = Boolean(frozenTraceIds || frozenReplayInfo.replayId);

  // The trace-logs endpoint treats an empty `query` as a real (non-null) additional
  // filter and would build a malformed `(...) and ` query. When there's no search to
  // apply (e.g. a combined replay + trace freeze relies on the endpoint's native OR of
  // the traceId/replayId params), omit the param entirely.
  const {query: searchQuery, ...baseQueryWithoutSearch} = baseQuery;
  const query =
    usesTraceLogsEndpoint && !searchQuery ? baseQueryWithoutSearch : baseQuery;

  const path = {organizationIdOrSlug: organization.slug};
  const data = {highFidelity};

  const infiniteApiOptions =
    frozenTraceIds || frozenReplayInfo.replayId
      ? apiOptions.asInfinite<EventsLogsResult>()(
          '/organizations/$organizationIdOrSlug/trace-logs/',
          {path, query, data, staleTime: 0}
        )
      : apiOptions.asInfinite<EventsLogsResult>()(
          '/organizations/$organizationIdOrSlug/events/',
          {path, query, data, staleTime: 0}
        );

  return {infiniteApiOptions, eventView, pageFiltersReady};
}

export function useLogsApiOptionsWithInfinite({
  referrer,
  autoRefresh,
  highFidelity,
}: {
  autoRefresh: boolean;
  referrer: string;
  highFidelity?: boolean;
}) {
  const {infiniteApiOptions, eventView, pageFiltersReady} = useLogsApiOptions({
    limit: autoRefresh ? QUERY_PAGE_LIMIT_WITH_AUTO_REFRESH : QUERY_PAGE_LIMIT,
    referrer,
    highFidelity,
  });
  return {
    infiniteApiOptions,
    other: {
      eventView,
      pageFiltersReady,
    },
  };
}
