import {useCallback, useMemo} from 'react';
import {mutationOptions} from '@tanstack/react-query';
import type {Location} from 'history';

import {useAnalyticsArea} from 'sentry/components/analyticsArea';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {AskSeerPollingComboBox} from 'sentry/components/searchQueryBuilder/askSeerCombobox/askSeerPollingComboBox';
import type {AskSeerSearchQuery} from 'sentry/components/searchQueryBuilder/askSeerCombobox/types';
import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/context';
import {parseQueryBuilderValue} from 'sentry/components/searchQueryBuilder/utils';
import {Token} from 'sentry/components/searchSyntax/parser';
import {stringifyToken} from 'sentry/components/searchSyntax/utils';
import {ConfigStore} from 'sentry/stores/configStore';
import type {DateString} from 'sentry/types/core';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getFieldDefinition} from 'sentry/utils/fields';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {LOGS_QUERY_KEY} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {
  LOGS_AGGREGATE_SORT_BYS_KEY,
  LOGS_SORT_BYS_KEY,
} from 'sentry/views/explore/contexts/logs/sortBys';
import {
  defaultVisualizes,
  LOGS_AGGREGATE_FIELD_KEY,
} from 'sentry/views/explore/logs/logsQueryParams';
import type {
  AggregateField,
  WritableAggregateField,
} from 'sentry/views/explore/queryParams/aggregateField';
import {useQueryParams} from 'sentry/views/explore/queryParams/context';
import {Mode} from 'sentry/views/explore/queryParams/mode';
import {isVisualize} from 'sentry/views/explore/queryParams/visualize';
import {ChartType, isChartType} from 'sentry/views/insights/common/components/chart';

export type {AskSeerSearchQuery};

type Visualization = AskSeerSearchQuery['visualizations'][number];

interface LogsAskSeerTranslateResponse {
  responses: Array<{
    end: string | null;
    group_by: string[];
    mode: string;
    query: string;
    sort: string;
    start: string | null;
    stats_period: string;
    visualization?: Array<{
      chart_type?: number;
      y_axes?: string[];
    }>;
  }>;
  unsupported_reason: string | null;
}

interface LogsSeerLocationQueryResult {
  groupBys: string[];
  mode: Mode;
  query: Location['query'];
  selection: {
    datetime: {
      end: DateString;
      period: string | null;
      start: DateString;
      utc: boolean | null;
    };
  };
  sort: string;
  visualizes: WritableAggregateField[];
}

function transformLogsSeerVisualizations(
  visualization?: LogsAskSeerTranslateResponse['responses'][number]['visualization']
): Visualization[] {
  return (
    visualization
      ?.map(v => ({
        chartType: isChartType(v?.chart_type) ? v.chart_type : ChartType.LINE,
        yAxes: v?.y_axes ?? [],
      }))
      .filter(v => v.yAxes.length > 0) ?? []
  );
}

function getLogsSeerMode(result: AskSeerSearchQuery): Mode {
  if ((result.groupBys?.length ?? 0) > 0 || result.mode === 'aggregates') {
    return Mode.AGGREGATE;
  }
  return Mode.SAMPLES;
}

function getLogsSeerAggregateFields({
  currentAggregateFields,
  groupBys,
  visualizations,
}: {
  currentAggregateFields: readonly AggregateField[];
  groupBys: string[];
  visualizations: Visualization[];
}): WritableAggregateField[] {
  const existingVisualizes = currentAggregateFields
    .filter(isVisualize)
    .map(visualize => visualize.serialize());
  const seerVisualizes = visualizations.map(({chartType, yAxes}) => ({
    chartType,
    yAxes,
  }));
  const visualizes = seerVisualizes.length
    ? seerVisualizes
    : existingVisualizes.length
      ? existingVisualizes
      : defaultVisualizes(true).map(visualize => visualize.serialize());

  return [...groupBys.map(groupBy => ({groupBy})), ...visualizes];
}

export function getLogsSeerLocationQuery({
  currentAggregateFields,
  currentLocationQuery,
  pageDatetime,
  result,
}: {
  currentAggregateFields: readonly AggregateField[];
  currentLocationQuery: Location['query'];
  pageDatetime: {
    end: DateString;
    period: string | null;
    start: DateString;
    utc: boolean | null;
  };
  result: AskSeerSearchQuery;
}): LogsSeerLocationQueryResult {
  const {
    query: queryToUse,
    groupBys,
    sort,
    statsPeriod,
    start: resultStart,
    end: resultEnd,
    visualizations,
  } = result;

  let start: DateString = null;
  let end: DateString = null;

  if (resultStart && resultEnd) {
    // Strip 'Z' suffix to treat UTC dates as local time
    const startLocal = resultStart.endsWith('Z') ? resultStart.slice(0, -1) : resultStart;
    const endLocal = resultEnd.endsWith('Z') ? resultEnd.slice(0, -1) : resultEnd;
    start = new Date(startLocal).toISOString();
    end = new Date(endLocal).toISOString();
  } else {
    start = pageDatetime.start;
    end = pageDatetime.end;
  }

  const mode = getLogsSeerMode(result);
  const selection = {
    datetime: {
      start,
      end,
      utc: pageDatetime.utc,
      period: resultStart && resultEnd ? null : statsPeriod || pageDatetime.period,
    },
  };
  const newQuery: Location['query'] = {
    ...currentLocationQuery,
    [LOGS_QUERY_KEY]: queryToUse,
    mode,
    start: selection.datetime.start?.toString() ?? null,
    end: selection.datetime.end?.toString() ?? null,
    statsPeriod: selection.datetime.period,
    utc: selection.datetime.utc?.toString() ?? null,
  };

  let visualizes: WritableAggregateField[] = [];
  if (mode === Mode.AGGREGATE) {
    visualizes = getLogsSeerAggregateFields({
      currentAggregateFields,
      groupBys,
      visualizations,
    });
    newQuery[LOGS_AGGREGATE_FIELD_KEY] = visualizes.map(field => JSON.stringify(field));
    if (sort) {
      newQuery[LOGS_AGGREGATE_SORT_BYS_KEY] = [sort];
    }
  } else if (sort) {
    newQuery[LOGS_SORT_BYS_KEY] = [sort];
  }

  return {
    query: newQuery,
    selection,
    mode,
    groupBys,
    visualizes,
    sort,
  };
}

export function LogsTabSeerComboBox() {
  const navigate = useNavigate();
  const location = useLocation();
  const {projects} = useProjects();
  const pageFilters = usePageFilters();
  const organization = useOrganization();
  const queryParams = useQueryParams();
  const analyticsArea = useAnalyticsArea();
  const {
    currentInputValueRef,
    query,
    committedQuery,
    askSeerSuggestedQueryRef,
    enableAISearch,
  } = useSearchQueryBuilder();

  let initialSeerQuery = '';
  const queryDetails = useMemo(() => {
    const queryToUse = committedQuery.length > 0 ? committedQuery : query;
    const parsedQuery = parseQueryBuilderValue(queryToUse, getFieldDefinition);
    return {parsedQuery, queryToUse};
  }, [committedQuery, query]);

  const inputValue = currentInputValueRef.current.trim();

  // Only filter out FREE_TEXT tokens if there's actual input value to filter by
  const filteredCommittedQuery = queryDetails?.parsedQuery
    ?.filter(
      token =>
        !(token.type === Token.FREE_TEXT && inputValue && token.text.includes(inputValue))
    )
    ?.map(token => stringifyToken(token))
    ?.join(' ')
    ?.trim();

  // Use filteredCommittedQuery if it exists and has content, otherwise fall back to queryToUse
  if (filteredCommittedQuery && filteredCommittedQuery.length > 0) {
    initialSeerQuery = filteredCommittedQuery;
  } else if (queryDetails?.queryToUse) {
    initialSeerQuery = queryDetails.queryToUse;
  }

  if (inputValue) {
    initialSeerQuery =
      initialSeerQuery === '' ? inputValue : `${initialSeerQuery} ${inputValue}`;
  }

  const logsTabAskSeerMutationOptions = mutationOptions({
    mutationFn: async (queryToSubmit: string) => {
      const selectedProjects =
        pageFilters.selection.projects?.length > 0 &&
        pageFilters.selection.projects?.[0] !== -1
          ? pageFilters.selection.projects
          : projects.filter(p => p.isMember).map(p => p.id);

      const user = ConfigStore.get('user');
      const data = await fetchMutation<LogsAskSeerTranslateResponse>({
        url: `/organizations/${organization.slug}/search-agent/translate/`,
        method: 'POST',
        data: {
          org_id: organization.id,
          org_slug: organization.slug,
          natural_language_query: queryToSubmit,
          project_ids: selectedProjects,
          strategy: 'Logs',
          user_email: user?.email,
        },
      });

      return {
        status: 'ok',
        unsupported_reason: data.unsupported_reason,
        queries: data.responses.map(r => ({
          visualizations: transformLogsSeerVisualizations(r?.visualization),
          query: r?.query ?? '',
          sort: r?.sort ?? '',
          groupBys: r?.group_by ?? [],
          statsPeriod: r?.stats_period ?? '',
          start: r?.start ?? null,
          end: r?.end ?? null,
          mode: r?.mode ?? 'samples',
        })),
      };
    },
  });

  const applySeerSearchQuery = useCallback(
    (result: AskSeerSearchQuery) => {
      if (!result) return;
      const locationQuery = getLogsSeerLocationQuery({
        result,
        currentLocationQuery: location.query,
        currentAggregateFields: queryParams.aggregateFields,
        pageDatetime: {
          start: pageFilters.selection.datetime.start,
          end: pageFilters.selection.datetime.end,
          period: pageFilters.selection.datetime.period,
          utc: pageFilters.selection.datetime.utc,
        },
      });

      const selection = {
        ...pageFilters.selection,
        datetime: locationQuery.selection.datetime,
      };

      askSeerSuggestedQueryRef.current = JSON.stringify({
        selection,
        query: result.query,
        visualize: locationQuery.visualizes,
        groupBys: locationQuery.groupBys,
        sort: locationQuery.sort,
        mode: locationQuery.mode,
      });
      const visualizeCount = result.visualizations?.length ?? 0;

      trackAnalytics('ai_query.applied', {
        organization,
        area: analyticsArea,
        query: result.query,
        group_by_count: locationQuery.groupBys.length,
        visualize_count: visualizeCount,
      });

      // Single navigation with all params (matches Trace Explorer pattern)
      navigate(
        {...location, query: locationQuery.query},
        {replace: true, preventScrollReset: true}
      );
    },
    [
      analyticsArea,
      askSeerSuggestedQueryRef,
      location,
      navigate,
      organization,
      pageFilters.selection,
      queryParams.aggregateFields,
    ]
  );

  // Get selected project IDs for the polling variant
  const selectedProjectIds = useMemo(() => {
    if (
      pageFilters.selection.projects?.length > 0 &&
      pageFilters.selection.projects?.[0] !== -1
    ) {
      return pageFilters.selection.projects;
    }
    return projects.filter(p => p.isMember).map(p => parseInt(p.id, 10));
  }, [pageFilters.selection.projects, projects]);

  // Transform the final_response from Seer to match the expected format
  const transformResponse = useCallback(
    (response: AskSeerSearchQuery): AskSeerSearchQuery[] => {
      const seerResponse = response as unknown as {
        responses?: Array<{
          end: string | null;
          group_by: string[];
          mode: string;
          query: string;
          sort: string;
          start: string | null;
          stats_period: string;
          visualization?: Array<{
            chart_type?: number;
            y_axes?: string[];
          }>;
        }>;
      };

      if (seerResponse.responses && Array.isArray(seerResponse.responses)) {
        return seerResponse.responses.map(r => ({
          visualizations: transformLogsSeerVisualizations(r?.visualization),
          query: r?.query ?? '',
          sort: r?.sort ?? '',
          groupBys: r?.group_by ?? [],
          statsPeriod: r?.stats_period ?? '',
          start: r?.start ?? null,
          end: r?.end ?? null,
          mode: r?.mode ?? 'samples',
        }));
      }

      return [response];
    },
    []
  );

  if (!enableAISearch) {
    return null;
  }

  return (
    <AskSeerPollingComboBox<AskSeerSearchQuery>
      initialQuery={initialSeerQuery}
      projectIds={selectedProjectIds}
      strategy="Logs"
      applySeerSearchQuery={applySeerSearchQuery}
      transformResponse={transformResponse}
      fallbackMutationOptions={logsTabAskSeerMutationOptions}
    />
  );
}
