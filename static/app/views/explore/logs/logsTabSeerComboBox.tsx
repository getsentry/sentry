import {useCallback} from 'react';
import {mutationOptions} from '@tanstack/react-query';

import {useAnalyticsArea} from 'sentry/components/analyticsArea';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {useAiQueryContext} from 'sentry/components/searchQueryBuilder/askSeerCombobox/aiQueryContext';
import {AskSeerPollingComboBox} from 'sentry/components/searchQueryBuilder/askSeerCombobox/askSeerPollingComboBox';
import type {SeerRawResponse} from 'sentry/components/searchQueryBuilder/askSeerCombobox/types';
import {
  buildSeerDateTimeSelection,
  transformSeerResponse,
  useInitialSeerQuery,
  useSelectedProjectIds,
  useSelectedProjectIdsForMutation,
} from 'sentry/components/searchQueryBuilder/askSeerCombobox/useSeerComboBoxSetup';
import {useSearchQueryBuilderAI} from 'sentry/components/searchQueryBuilder/context';
import {ConfigStore} from 'sentry/stores/configStore';
import {trackAnalytics} from 'sentry/utils/analytics';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {LOGS_QUERY_KEY} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {LOGS_AGGREGATE_FIELD_KEY} from 'sentry/views/explore/logs/logsQueryParams';
import type {WritableAggregateField} from 'sentry/views/explore/queryParams/aggregateField';
import {useQueryParams} from 'sentry/views/explore/queryParams/context';
import {isGroupBy} from 'sentry/views/explore/queryParams/groupBy';
import {Mode} from 'sentry/views/explore/queryParams/mode';
import {isVisualize} from 'sentry/views/explore/queryParams/visualize';

interface AskSeerSearchQuery {
  end: string | null;
  groupBys: string[];
  mode: string;
  query: string;
  sort: string;
  start: string | null;
  statsPeriod: string;
}

export function LogsTabSeerComboBox() {
  const navigate = useNavigate();
  const location = useLocation();
  const pageFilters = usePageFilters();
  const organization = useOrganization();
  const queryParams = useQueryParams();
  const analyticsArea = useAnalyticsArea();
  const {setRunId} = useAiQueryContext();
  const {askSeerSuggestedQueryRef, enableAISearch} = useSearchQueryBuilderAI();

  const initialSeerQuery = useInitialSeerQuery();
  const selectedProjectIds = useSelectedProjectIds();
  const selectedProjectIdsForMutation = useSelectedProjectIdsForMutation();

  const logsTabAskSeerMutationOptions = mutationOptions({
    mutationFn: async (queryToSubmit: string) => {
      const user = ConfigStore.get('user');
      const data = await fetchMutation<SeerRawResponse>({
        url: `/organizations/${organization.slug}/search-agent/translate/`,
        method: 'POST',
        data: {
          org_id: organization.id,
          org_slug: organization.slug,
          natural_language_query: queryToSubmit,
          project_ids: selectedProjectIdsForMutation,
          strategy: 'Logs',
          user_email: user?.email,
        },
      });

      return {
        status: 'ok',
        unsupported_reason: data.unsupported_reason,
        queries: data.responses.map(r => ({
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
    (result: AskSeerSearchQuery, runId?: number) => {
      if (!result) {
        return;
      }
      const {
        query: queryToUse,
        groupBys,
        statsPeriod,
        start: resultStart,
        end: resultEnd,
      } = result;

      const dt = buildSeerDateTimeSelection(
        resultStart,
        resultEnd,
        statsPeriod,
        pageFilters.selection.datetime
      );

      const start = dt.start;
      const end = dt.end;

      const mode =
        groupBys.length > 0
          ? Mode.AGGREGATE
          : result.mode === 'aggregates'
            ? Mode.AGGREGATE
            : Mode.SAMPLES;

      // Build aggregateFields: combines groupBys with existing visualizations,
      // preserving the existing field ordering (groupBy-before-visualize vs
      // visualize-before-groupBy layout).
      let seenVisualizes = false;
      let groupByAfterVisualizes = false;

      for (const aggregateField of queryParams.aggregateFields) {
        if (isGroupBy(aggregateField) && seenVisualizes) {
          groupByAfterVisualizes = true;
          break;
        } else if (isVisualize(aggregateField)) {
          seenVisualizes = true;
        }
      }

      const aggregateFields: WritableAggregateField[] = [];
      const iter = groupBys[Symbol.iterator]();

      for (const aggregateField of queryParams.aggregateFields) {
        if (isVisualize(aggregateField)) {
          if (!groupByAfterVisualizes) {
            for (const groupBy of iter) {
              aggregateFields.push({groupBy});
            }
          }
          aggregateFields.push(aggregateField.serialize());
        } else if (isGroupBy(aggregateField)) {
          const {value: groupBy, done} = iter.next();
          if (!done) {
            aggregateFields.push({groupBy});
          }
        }
      }

      for (const groupBy of iter) {
        aggregateFields.push({groupBy});
      }

      const selection = {
        ...pageFilters.selection,
        datetime: {start, end, utc: dt.utc, period: dt.period},
      };

      const newQuery = {
        ...location.query,
        [LOGS_QUERY_KEY]: queryToUse,
        mode,
        [LOGS_AGGREGATE_FIELD_KEY]: aggregateFields.map(field => JSON.stringify(field)),
        start: selection.datetime.start,
        end: selection.datetime.end,
        statsPeriod: selection.datetime.period,
        utc: selection.datetime.utc,
      };

      askSeerSuggestedQueryRef.current = JSON.stringify({
        selection,
        query: queryToUse,
        groupBys,
        mode,
      });

      trackAnalytics('ai_query.applied', {
        organization,
        area: analyticsArea,
        query: queryToUse,
        group_by_count: groupBys.length,
      });

      if (runId !== undefined) {
        setRunId(runId);
      }

      navigate({...location, query: newQuery}, {replace: true, preventScrollReset: true});
    },
    [
      analyticsArea,
      askSeerSuggestedQueryRef,
      location,
      navigate,
      organization,
      pageFilters.selection,
      queryParams.aggregateFields,
      setRunId,
    ]
  );

  const transformResponse = useCallback(
    (response: AskSeerSearchQuery): AskSeerSearchQuery[] =>
      transformSeerResponse(response, r => ({
        query: r?.query ?? '',
        sort: r?.sort ?? '',
        groupBys: r?.group_by ?? [],
        statsPeriod: r?.stats_period ?? '',
        start: r?.start ?? null,
        end: r?.end ?? null,
        mode: r?.mode ?? 'samples',
      })),
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
