import {useMemo} from 'react';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {
  useSearchQueryBuilderAI,
  useSearchQueryBuilderLayout,
  useSearchQueryBuilderState,
} from 'sentry/components/searchQueryBuilder/context';
import {Token} from 'sentry/components/searchSyntax/parser';
import {stringifyToken} from 'sentry/components/searchSyntax/utils';
import type {DateString} from 'sentry/types/core';
import type {PageFilters} from 'sentry/types/core';
import {getUtcDateString} from 'sentry/utils/dates';
import {useProjects} from 'sentry/utils/useProjects';
import {parseTraceMetricFromQuery} from 'sentry/views/explore/metrics/utils';
import type {CrossEvent} from 'sentry/views/explore/queryParams/crossEvent';
import {makeCrossEvent} from 'sentry/views/explore/spans/crossEvents/utils';
import {isChartType} from 'sentry/views/insights/common/components/chart';

import type {
  AskSeerSearchQuery,
  QueryTokensProps,
  SeerRawResponse,
  SeerRawResponseItem,
} from './types';
import {getExpandedProjectIds} from './utils';

export function useInitialSeerQuery(): string {
  const {query, committedQuery, parseQuery} = useSearchQueryBuilderState();
  const {autoSubmitFromCurrentQuery, autoSubmitSeer, displayAskSeer} =
    useSearchQueryBuilderAI();
  const {currentInputValueRef} = useSearchQueryBuilderLayout();
  const isAutoSubmittingCurrentQuery =
    autoSubmitFromCurrentQuery && autoSubmitSeer && displayAskSeer;

  const queryDetails = useMemo(() => {
    let queryToUse = query;
    if (!isAutoSubmittingCurrentQuery && committedQuery.length > 0) {
      queryToUse = committedQuery;
    }

    const parsedQuery = parseQuery(queryToUse);
    return {parsedQuery, queryToUse};
  }, [committedQuery, isAutoSubmittingCurrentQuery, parseQuery, query]);

  const inputValue = currentInputValueRef.current.trim();

  // Only filter out FREE_TEXT tokens if there's actual input value to filter by
  const filteredCommittedQuery = queryDetails?.parsedQuery
    ?.filter(
      token =>
        !(
          token.type === Token.FREE_TEXT &&
          inputValue &&
          (isAutoSubmittingCurrentQuery || token.text.includes(inputValue))
        )
    )
    ?.map(token => stringifyToken(token))
    ?.join(' ')
    ?.trim();

  let initialSeerQuery = '';

  // Use filteredCommittedQuery if it has content.
  // Only fall back to queryToUse when there's no inputValue to filter by.
  // This prevents duplication when the entire query is free text matching inputValue.
  if (filteredCommittedQuery && filteredCommittedQuery.length > 0) {
    initialSeerQuery = filteredCommittedQuery;
  } else if (!inputValue && queryDetails?.queryToUse) {
    initialSeerQuery = queryDetails.queryToUse;
  }

  if (inputValue) {
    initialSeerQuery =
      initialSeerQuery === '' ? inputValue : `${initialSeerQuery} ${inputValue}`;
  }

  return initialSeerQuery;
}

export function useSelectedProjectIds(): number[] {
  const pageFilters = usePageFilters();
  const {projects} = useProjects();

  return useMemo(() => {
    if (
      pageFilters.selection.projects?.length > 0 &&
      pageFilters.selection.projects?.[0] !== -1
    ) {
      return pageFilters.selection.projects;
    }
    return projects.filter(p => p.isMember).map(p => parseInt(p.id, 10));
  }, [pageFilters.selection.projects, projects]);
}

export function useSelectedProjectIdsForMutation(): Array<number | string> {
  const pageFilters = usePageFilters();
  const {projects} = useProjects();

  return useMemo(() => {
    if (
      pageFilters.selection.projects?.length > 0 &&
      pageFilters.selection.projects?.[0] !== -1
    ) {
      return pageFilters.selection.projects;
    }
    return projects.filter(p => p.isMember).map(p => p.id);
  }, [pageFilters.selection.projects, projects]);
}

function mapResponsesWithExpansion<T extends QueryTokensProps>(
  responses: SeerRawResponseItem[],
  projectIds: number[] | null | undefined,
  selectedProjectIds: number[] | undefined,
  mapItem: (item: SeerRawResponseItem) => T
): T[] {
  const expandedProjectIds = selectedProjectIds
    ? getExpandedProjectIds(projectIds, selectedProjectIds)
    : undefined;

  return responses.map(item => ({
    ...mapItem(item),
    ...(expandedProjectIds ? {expandedProjectIds} : {}),
  }));
}

export function transformSeerResponse<T extends QueryTokensProps>(
  response: T,
  mapItem: (item: SeerRawResponseItem) => T,
  selectedProjectIds?: number[]
): T[] {
  // The polling `final_response` is a serialized `SeerRawResponse` envelope at
  // runtime, even though the combobox types it as a single item. We reconcile
  // that narrowing here once, rather than asserting in every ComboBox.
  const envelope = response as unknown as SeerRawResponse;

  if (!Array.isArray(envelope.responses)) {
    return [response];
  }

  return mapResponsesWithExpansion(
    envelope.responses,
    envelope.project_ids,
    selectedProjectIds,
    mapItem
  );
}

export function buildSeerMutationResult<T extends QueryTokensProps>(
  data: SeerRawResponse,
  selectedProjectIds: number[],
  mapItem: (item: SeerRawResponseItem) => T
): {queries: T[]; status: string; unsupported_reason: string | null} {
  return {
    status: 'ok',
    unsupported_reason: data.unsupported_reason,
    queries: mapResponsesWithExpansion(
      data.responses,
      data.project_ids,
      selectedProjectIds,
      mapItem
    ),
  };
}

function buildCrossEvents(item: SeerRawResponseItem): CrossEvent[] {
  const crossEvents: CrossEvent[] = [];
  if (item.span_query) {
    crossEvents.push(makeCrossEvent('spans', item.span_query));
  }
  if (item.log_query) {
    crossEvents.push(makeCrossEvent('logs', item.log_query));
  }
  if (item.metric_query) {
    // A metric cross-event needs a parseable metric identity (metric.name/type)
    // in the query. parseTraceMetricFromQuery returns no metric when it's absent
    // (e.g. an aggregate-mode sibling whose identity lives in the visualization),
    // and we drop the cross-event in that case.
    const {metric, rest} = parseTraceMetricFromQuery(item.metric_query);
    if (metric) {
      crossEvents.push({type: 'metrics', query: rest, metric});
    }
  }
  return crossEvents;
}

export function mapSeerResponseItem(
  item: SeerRawResponseItem,
  defaultMode = 'samples'
): AskSeerSearchQuery {
  const interval = getRawSeerInterval(item);
  const crossEvents = defaultMode === 'spans' ? buildCrossEvents(item) : [];
  return {
    visualizations:
      item.visualization
        ?.map(visualization => ({
          ...(isChartType(visualization.chart_type)
            ? {chartType: visualization.chart_type}
            : {}),
          yAxes: visualization.y_axes ?? [],
        }))
        .filter(visualization => visualization.yAxes.length > 0) ?? [],
    query: item.query ?? '',
    sort: item.sort ?? '',
    groupBys: item.group_by ?? [],
    statsPeriod: item.stats_period ?? '',
    start: item.start ?? null,
    end: item.end ?? null,
    mode: item.mode || defaultMode,
    ...(interval ? {interval} : {}),
    ...(crossEvents.length ? {crossEvents} : {}),
  };
}

// Seer returns the interval nested per-visualization, but the chart uses a
// single shared interval. Hoist the interval from the first plotted
// visualization (one with y-axes, matching what `mapSeerResponseItem` keeps) so
// we don't pick up an interval from a dropped, axis-less entry.
function getRawSeerInterval(item: SeerRawResponseItem): string | undefined {
  return (
    item.visualization?.find(
      ({interval, y_axes}) => Boolean(interval) && (y_axes?.length ?? 0) > 0
    )?.interval ?? undefined
  );
}

export interface SeerDateTimeSelection {
  end: DateString;
  period: string | null;
  start: DateString;
  utc: boolean | null;
}

export function buildSeerDateTimeSelection(
  resultStart: string | null,
  resultEnd: string | null,
  statsPeriod: string,
  pageFiltersDatetime: PageFilters['datetime']
): SeerDateTimeSelection {
  let start: DateString = null;
  let end: DateString = null;

  if (resultStart && resultEnd) {
    start = getUtcDateString(resultStart);
    end = getUtcDateString(resultEnd);
  } else {
    start = pageFiltersDatetime.start;
    end = pageFiltersDatetime.end;
  }

  return {
    start,
    end,
    // Seer returns absolute ranges as UTC, so display them in UTC to match the
    // suggestion preview the user accepted.
    utc: resultStart && resultEnd ? true : pageFiltersDatetime.utc,
    period: resultStart && resultEnd ? null : statsPeriod || pageFiltersDatetime.period,
  };
}
