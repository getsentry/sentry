import {useCallback, useMemo} from 'react';

import {AskSeerComboBox} from 'sentry/components/searchQueryBuilder/askSeerCombobox/askSeerComboBox';
import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/context';
import {parseQueryBuilderValue} from 'sentry/components/searchQueryBuilder/utils';
import {Token} from 'sentry/components/searchSyntax/parser';
import {stringifyToken} from 'sentry/components/searchSyntax/utils';
import ConfigStore from 'sentry/stores/configStore';
import type {DateString} from 'sentry/types/core';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getFieldDefinition} from 'sentry/utils/fields';
import {fetchMutation, mutationOptions} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
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

interface LogsAskSeerTranslateResponse {
  responses: Array<{
    end: string | null;
    group_by: string[];
    mode: string;
    query: string;
    sort: string;
    start: string | null;
    stats_period: string;
  }>;
  unsupported_reason: string | null;
}

export function LogsTabSeerComboBox() {
  const navigate = useNavigate();
  const location = useLocation();
  const {projects} = useProjects();
  const pageFilters = usePageFilters();
  const organization = useOrganization();
  const queryParams = useQueryParams();
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
      const {
        query: queryToUse,
        groupBys,
        statsPeriod,
        start: resultStart,
        end: resultEnd,
      } = result;

      let start: DateString = null;
      let end: DateString = null;

      if (resultStart && resultEnd) {
        // Strip 'Z' suffix to treat UTC dates as local time
        const startLocal = resultStart.endsWith('Z')
          ? resultStart.slice(0, -1)
          : resultStart;
        const endLocal = resultEnd.endsWith('Z') ? resultEnd.slice(0, -1) : resultEnd;
        start = new Date(startLocal).toISOString();
        end = new Date(endLocal).toISOString();
      } else {
        start = pageFilters.selection.datetime.start;
        end = pageFilters.selection.datetime.end;
      }

      // Update mode based on groupBys or response mode (matches Trace Explorer logic)
      const mode =
        groupBys.length > 0
          ? Mode.AGGREGATE
          : result.mode === 'aggregates'
            ? Mode.AGGREGATE
            : Mode.SAMPLES;

      // Build aggregateFields array (similar to useSetQueryParamsGroupBys logic)
      // This combines groupBys with existing visualizations
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
            // Insert group bys before visualizes
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

      // Add any remaining group bys
      for (const groupBy of iter) {
        aggregateFields.push({groupBy});
      }

      // Build datetime selection similar to Trace Explorer
      const selection = {
        ...pageFilters.selection,
        datetime: {
          start,
          end,
          utc: pageFilters.selection.datetime.utc,
          period:
            resultStart && resultEnd
              ? null
              : statsPeriod || pageFilters.selection.datetime.period,
        },
      };

      // Build complete URL with all params (query, mode, aggregateFields, datetime)
      // This matches the Trace Explorer pattern of single navigation
      const newQuery = {
        ...location.query,
        [LOGS_QUERY_KEY]: queryToUse,
        mode,
        [LOGS_AGGREGATE_FIELD_KEY]: aggregateFields.map(field => JSON.stringify(field)),
        // Datetime params from selection
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

      trackAnalytics('logs.ai_query_applied', {
        organization,
        query: queryToUse,
        group_by_count: groupBys.length,
      });

      // Single navigation with all params (matches Trace Explorer pattern)
      navigate({...location, query: newQuery}, {replace: true, preventScrollReset: true});
    },
    [
      askSeerSuggestedQueryRef,
      location,
      navigate,
      organization,
      pageFilters.selection,
      queryParams.aggregateFields,
    ]
  );

  const areAiFeaturesAllowed =
    enableAISearch &&
    !organization?.hideAiFeatures &&
    organization.features.includes('gen-ai-features');

  if (!areAiFeaturesAllowed) {
    return null;
  }

  return (
    <AskSeerComboBox
      initialQuery={initialSeerQuery}
      askSeerMutationOptions={logsTabAskSeerMutationOptions}
      applySeerSearchQuery={applySeerSearchQuery}
      analyticsSource="logs"
      feedbackSource="logs_ai_query"
    />
  );
}
