import {useCallback, useState} from 'react';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/context';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {fetchMutation, useMutation} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
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

export interface AskSeerSearchItem<S extends string> extends AskSeerSearchQuery {
  key: S extends 'none-of-these' ? never : S;
}

interface AskSeerSearchResponse {
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
  unsupported_reason?: string;
}

export const useAskSeerSearch = () => {
  const {projects} = useProjects();
  const pageFilters = usePageFilters();
  const organization = useOrganization();
  const memberProjects = projects.filter(p => p.isMember);
  const [rawResult, setRawResult] = useState<AskSeerSearchQuery[]>([]);
  const [unsupportedReason, setUnsupportedReason] = useState<string | null>(null);

  const {
    mutate: submitQuery,
    isPending,
    isError,
  } = useMutation<AskSeerSearchResponse, RequestError, string>({
    mutationFn: (query: string) => {
      const selectedProjects =
        pageFilters.selection.projects?.length > 0 &&
        pageFilters.selection.projects?.[0] !== -1
          ? pageFilters.selection.projects
          : memberProjects.map(p => p.id);

      return fetchMutation({
        url: `/organizations/${organization.slug}/trace-explorer-ai/query/`,
        method: 'POST',
        data: {
          natural_language_query: query,
          project_ids: selectedProjects,
          use_flyout: false,
          limit: 3,
        },
      });
    },
    onSuccess: result => {
      setUnsupportedReason(result.unsupported_reason || null);
      setRawResult(
        result.queries.map((query: any) => {
          const visualizations =
            query?.visualization?.map((v: any) => ({
              chartType: v?.chart_type,
              yAxes: v?.y_axes,
            })) ?? [];

          return {
            visualizations,
            query: query?.query,
            sort: query?.sort ?? '',
            groupBys: query?.group_by ?? [],
            statsPeriod: query?.stats_period ?? '',
            mode: query?.mode ?? 'spans',
          };
        })
      );
    },
    onError: (error: Error) => {
      setUnsupportedReason(null);
      addErrorMessage(t('Failed to process AI query: %(error)s', {error: error.message}));
    },
  });

  return {
    rawResult,
    submitQuery,
    isPending,
    isError,
    unsupportedReason,
  };
};

export const useApplySeerSearchQuery = () => {
  const navigate = useNavigate();
  const pageFilters = usePageFilters();
  const organization = useOrganization();

  const {askSeerSuggestedQueryRef} = useSearchQueryBuilder();

  return useCallback(
    (result: AskSeerSearchQuery) => {
      if (!result) return;
      const {query, visualizations, groupBys, sort, statsPeriod} = result;

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
        query,
        visualize,
        groupBy: groupBys,
        sort,
        mode,
      });

      askSeerSuggestedQueryRef.current = JSON.stringify({
        selection,
        query,
        visualize,
        groupBy: groupBys,
        sort,
        mode,
      });
      trackAnalytics('trace.explorer.ai_query_applied', {
        organization,
        query,
        group_by_count: groupBys.length,
        visualize_count: visualizations.length,
      });
      navigate(url, {replace: true, preventScrollReset: true});
    },
    [askSeerSuggestedQueryRef, navigate, organization, pageFilters.selection]
  );
};
