import {useCallback, useMemo} from 'react';

import {AskSeerComboBox} from 'sentry/components/searchQueryBuilder/askSeerCombobox/askSeerComboBox';
import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/context';
import {parseQueryBuilderValue} from 'sentry/components/searchQueryBuilder/utils';
import {Token} from 'sentry/components/searchSyntax/parser';
import {stringifyToken} from 'sentry/components/searchSyntax/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getFieldDefinition} from 'sentry/utils/fields';
import {fetchMutation, mutationOptions} from 'sentry/utils/queryClient';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {Mode} from 'sentry/views/explore/queryParams/mode';
import {getExploreUrl} from 'sentry/views/explore/utils';
import type {ChartType} from 'sentry/views/insights/common/components/chart';

interface Visualization {
  chartType: ChartType;
  yAxes: string[];
}

interface AskSeerSearchQuery {
  groupBys: string[];
  mode: string;
  query: string;
  sort: string;
  statsPeriod: string;
  visualizations: Visualization[];
}

interface TraceAskSeerSearchResponse {
  queries: Array<{
    group_by: string[];
    mode: string;
    query: string;
    sort: string;
    stats_period: string;
    visualization: Array<{
      chart_type: number;
      y_axes: string[];
    }>;
  }>;
  status: string;
  unsupported_reason: string | null;
}

export function SpansTabSeerComboBox() {
  const navigate = useNavigate();
  const {projects} = useProjects();
  const pageFilters = usePageFilters();
  const organization = useOrganization();
  const {currentInputValueRef, query, committedQuery, askSeerSuggestedQueryRef} =
    useSearchQueryBuilder();

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

  const spansTabAskSeerMutationOptions = mutationOptions({
    mutationFn: async (queryToSubmit: string) => {
      const selectedProjects =
        pageFilters.selection.projects?.length > 0 &&
        pageFilters.selection.projects?.[0] !== -1
          ? pageFilters.selection.projects
          : projects.filter(p => p.isMember).map(p => p.id);

      const data = await fetchMutation<TraceAskSeerSearchResponse>({
        url: `/organizations/${organization.slug}/trace-explorer-ai/query/`,
        method: 'POST',
        data: {
          natural_language_query: queryToSubmit,
          project_ids: selectedProjects,
          use_flyout: false,
          limit: 3,
        },
      });

      return {
        ...data,
        queries: data.queries.map(q => ({
          visualizations:
            q?.visualization?.map((v: any) => ({
              chartType: v?.chart_type,
              yAxes: v?.y_axes,
            })) ?? [],
          query: q?.query,
          sort: q?.sort ?? '',
          groupBys: q?.group_by ?? [],
          statsPeriod: q?.stats_period ?? '',
          mode: q?.mode ?? 'spans',
        })),
      };
    },
  });

  const applySeerSearchQuery = useCallback(
    (result: AskSeerSearchQuery) => {
      if (!result) return;
      const {query: queryToUse, visualizations, groupBys, sort, statsPeriod} = result;

      const startFilter = pageFilters.selection.datetime.start?.valueOf();
      const start = startFilter
        ? new Date(startFilter).toISOString()
        : pageFilters.selection.datetime.start;

      const endFilter = pageFilters.selection.datetime.end?.valueOf();
      const end = endFilter
        ? new Date(endFilter).toISOString()
        : pageFilters.selection.datetime.end;

      const selection = {
        ...pageFilters.selection,
        datetime: {
          start,
          end,
          utc: pageFilters.selection.datetime.utc,
          period: statsPeriod || pageFilters.selection.datetime.period,
        },
      };

      // TODO: Include traces mode once we can switch the table in getExploreUrl
      const mode =
        groupBys.length > 0
          ? Mode.AGGREGATE
          : result.mode === 'aggregates'
            ? Mode.AGGREGATE
            : Mode.SAMPLES;
      const visualize =
        visualizations?.map((v: Visualization) => ({
          chartType: v.chartType,
          yAxes: v.yAxes,
        })) ?? [];

      const url = getExploreUrl({
        organization,
        selection,
        query: queryToUse,
        visualize,
        groupBy: groupBys,
        sort,
        mode,
      });

      askSeerSuggestedQueryRef.current = JSON.stringify({
        selection,
        query: queryToUse,
        visualize,
        groupBy: groupBys,
        sort,
        mode,
      });
      trackAnalytics('trace.explorer.ai_query_applied', {
        organization,
        query: queryToUse,
        group_by_count: groupBys.length,
        visualize_count: visualizations.length,
      });
      navigate(url, {replace: true, preventScrollReset: true});
    },
    [askSeerSuggestedQueryRef, navigate, organization, pageFilters.selection]
  );

  return (
    <AskSeerComboBox
      initialQuery={initialSeerQuery}
      askSeerMutationOptions={spansTabAskSeerMutationOptions}
      applySeerSearchQuery={applySeerSearchQuery}
    />
  );
}
