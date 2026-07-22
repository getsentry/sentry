import {useCallback} from 'react';
import {mutationOptions} from '@tanstack/react-query';
import omit from 'lodash/omit';

import {useAnalyticsArea} from 'sentry/components/analyticsArea';
import {openConfirmModal} from 'sentry/components/confirm';
import {ALL_DATE_TIME_QUERY_KEYS} from 'sentry/components/pageFilters/constants';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {useAiQueryContext} from 'sentry/components/searchQueryBuilder/askSeerCombobox/aiQueryContext';
import {AskSeerComboBox} from 'sentry/components/searchQueryBuilder/askSeerCombobox/askSeerComboBox';
import {AskSeerPollingComboBox} from 'sentry/components/searchQueryBuilder/askSeerCombobox/askSeerPollingComboBox';
import type {
  AskSeerSearchQuery,
  SeerRawResponse,
} from 'sentry/components/searchQueryBuilder/askSeerCombobox/types';
import {
  buildSeerMutationResult,
  mapSeerResponseItem,
  transformSeerResponse,
  useInitialSeerQuery,
  useSelectedProjectIds,
  useSelectedProjectIdsForMutation,
} from 'sentry/components/searchQueryBuilder/askSeerCombobox/useSeerComboBoxSetup';
import {resolveSeerProjectSelection} from 'sentry/components/searchQueryBuilder/askSeerCombobox/utils';
import {useSearchQueryBuilderAI} from 'sentry/components/searchQueryBuilder/context';
import {t} from 'sentry/locale';
import {ConfigStore} from 'sentry/stores/configStore';
import {trackAnalytics} from 'sentry/utils/analytics';
import {EQUATION_PREFIX, isEquation} from 'sentry/utils/discover/fields';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {DEFAULT_YAXIS_BY_TYPE, NONE_UNIT} from 'sentry/views/explore/metrics/constants';
import {syncEquationMetricQueries} from 'sentry/views/explore/metrics/equationBuilder/utils';
import {getMetricReferences} from 'sentry/views/explore/metrics/hooks/useMetricReferences';
import {
  defaultAggregateSortBys,
  encodeMetricQueryParams,
  type BaseMetricQuery,
  type TraceMetric,
} from 'sentry/views/explore/metrics/metricQuery';
import {useMultiMetricsQueryParams} from 'sentry/views/explore/metrics/multiMetricsQueryParams';
import {parseAggregateExpression} from 'sentry/views/explore/metrics/parseAggregateExpression';
import {parseMetricAggregate} from 'sentry/views/explore/metrics/parseMetricsAggregate';
import {isTraceMetricTypeValue} from 'sentry/views/explore/metrics/types';
import {
  encodeEquationMetricQueries,
  makeMetricsAggregate,
  parseTraceMetricFromQuery,
  remapEquationLabels,
  spliceEquationQueries,
  stripTraceMetricTokens,
} from 'sentry/views/explore/metrics/utils';
import type {AggregateField} from 'sentry/views/explore/queryParams/aggregateField';
import {useQueryParams} from 'sentry/views/explore/queryParams/context';
import {Mode} from 'sentry/views/explore/queryParams/mode';
import {
  isVisualize,
  isVisualizeEquation,
  VisualizeFunction,
} from 'sentry/views/explore/queryParams/visualize';
import {getSeerExploreQuery, getSeerSort} from 'sentry/views/explore/seerQuery';
import {getFunctionLabel} from 'sentry/views/explore/toolbar/toolbarVisualize';
interface MetricsTabSeerComboBoxProps {
  traceMetric: TraceMetric;
}

export function MetricsTabSeerComboBox({traceMetric}: MetricsTabSeerComboBoxProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const pageFilters = usePageFilters();
  const {setRunId} = useAiQueryContext();
  const organization = useOrganization();
  const {projects} = useProjects();
  const queryParams = useQueryParams();
  const metricQueries = useMultiMetricsQueryParams();
  const analyticsArea = useAnalyticsArea();
  const {askSeerSuggestedQueryRef, enableAISearch} = useSearchQueryBuilderAI();

  const initialSeerQuery = useInitialSeerQuery();
  const selectedProjectIds = useSelectedProjectIds();
  const selectedProjectIdsForMutation = useSelectedProjectIdsForMutation();

  const metricsTabAskSeerMutationOptions = mutationOptions({
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
          strategy: 'Metrics',
          user_email: user?.email,
          options: {
            metric_context: {
              metric_name: traceMetric.name,
              metric_type: traceMetric.type,
              metric_unit: traceMetric.unit ?? NONE_UNIT,
            },
          },
        },
      });

      return buildSeerMutationResult(data, selectedProjectIds, response =>
        mapSeerResponseItem(response)
      );
    },
  });

  const applySeerSearchQuery = useCallback(
    (result: AskSeerSearchQuery, runId?: number | string) => {
      if (!result) {
        return;
      }

      const seerQuery = getSeerExploreQuery({
        result,
        pageDatetime: pageFilters.selection.datetime,
      });

      // Seer responses only return equations or functions at the moment, but equations need special handling
      // to generate its base metricQueries.
      const seerVisualizeFunctions = (result.visualizations ?? []).flatMap(viz =>
        viz.yAxes
          .filter(yAxis => !isEquation(yAxis))
          .map(yAxis => new VisualizeFunction(yAxis, {chartType: viz.chartType}))
      );

      // Parse out the metric queries required for equations.
      const seerEquationMetricQueries = (result.visualizations ?? []).flatMap(viz =>
        viz.yAxes.filter(isEquation).flatMap(yAxis => {
          const parsed = parseAggregateExpression(yAxis);
          return [
            ...parsed.metricQueries,
            ...(parsed.equationRow ? [parsed.equationRow] : []),
          ];
        })
      );

      // Move any `project:` filter Seer put in the query onto the page-level
      // project selector so it isn't duplicated in the search bar. Metric-filter
      // cleanup below runs on the project-stripped query.
      const {query: projectCleanedQuery, projectIds} = resolveSeerProjectSelection(
        seerQuery.query,
        projects,
        result.expandedProjectIds
      );

      // Keep the panel's TraceMetric in sync with what Seer queried. We prefer
      // the metric parsed out of the visualize aggregate (e.g.
      // p75(value, metric.name, distribution, millisecond)); otherwise we fall
      // back to the metric.name/type/unit filters in the query (samples mode),
      // which parseTraceMetricFromQuery also strips back out for us.
      const visualizationTraceMetric = (result.visualizations ?? [])
        .flatMap(viz => viz.yAxes)
        .map(yAxis => parseMetricAggregate(yAxis).traceMetric)
        .find(
          metric => metric.name && metric.type && isTraceMetricTypeValue(metric.type)
        );

      const {metric: queryTraceMetric} = parseTraceMetricFromQuery(projectCleanedQuery);

      // Prefer the visualization metric (normalizing its unit to NONE_UNIT, since
      // parseMetricAggregate omits the unit arg), falling back to the query-filter
      // metric. Left undefined when neither yields a valid metric — we then keep
      // the panel's existing metric and the query untouched.
      const resolvedMetric = visualizationTraceMetric
        ? {...visualizationTraceMetric, unit: visualizationTraceMetric.unit ?? NONE_UNIT}
        : queryTraceMetric;

      const nextMetric = resolvedMetric ?? traceMetric;

      // Strip the metric identity tokens whenever we adopt a metric (it's tracked
      // on the panel, not the query). Done unconditionally so stale/incomplete
      // metric.* tokens don't linger when the metric came from the visualization
      // aggregate rather than the query. Runs on the project-stripped query.
      const cleanedQuery = resolvedMetric
        ? stripTraceMetricTokens(projectCleanedQuery)
        : projectCleanedQuery;

      const aggregateFields: AggregateField[] = [];

      for (const groupBy of seerQuery.groupBys) {
        aggregateFields.push({groupBy});
      }

      // Apply Seer's visualizes. Seer should return metric-qualified y-axes
      // (e.g. p75(value, metric.name, distribution, millisecond)), which we pass
      // through untouched. Visualize aggregates are always in plain
      // op(value,metric,type,unit) form — conditional `_if` aggregates are
      // normalized to a plain aggregate plus a query filter before reaching a
      // visualize (see parseAggregateExpression) — so re-qualifying never drops
      // a filter argument. Defensively, if a y-axis comes back without a valid
      // metric, we re-qualify it with the resolved metric so the chart stays
      // aligned with the toolbar/samples. In samples mode there's no visualize,
      // so build a default one from the metric's type. When Seer didn't resolve
      // a valid metric, leave the existing visualizes untouched so we don't
      // clobber a customized aggregate.
      if (seerVisualizeFunctions.length > 0) {
        for (const viz of seerVisualizeFunctions) {
          const {aggregation, traceMetric: vizMetric} = parseMetricAggregate(viz.yAxis);
          const isQualified = Boolean(
            vizMetric.name && vizMetric.type && isTraceMetricTypeValue(vizMetric.type)
          );
          if (!isQualified && resolvedMetric) {
            aggregateFields.push(
              viz.replace({
                yAxis: makeMetricsAggregate({
                  aggregate: aggregation,
                  traceMetric: resolvedMetric,
                }),
              })
            );
          } else {
            aggregateFields.push(viz);
          }
        }
      } else if (resolvedMetric) {
        const defaultAggregate = DEFAULT_YAXIS_BY_TYPE[resolvedMetric.type];
        if (defaultAggregate) {
          aggregateFields.push(
            new VisualizeFunction(
              makeMetricsAggregate({
                aggregate: defaultAggregate,
                traceMetric: resolvedMetric,
              })
            )
          );
        }
      } else {
        for (const field of queryParams.aggregateFields) {
          if (isVisualize(field)) {
            aggregateFields.push(field);
          }
        }
      }

      const seerSort = getSeerSort(seerQuery.sort);
      const aggregateSortBys =
        seerQuery.mode === Mode.AGGREGATE && seerSort
          ? [seerSort]
          : defaultAggregateSortBys(aggregateFields);
      const sortBys =
        seerQuery.mode === Mode.SAMPLES && seerSort ? [seerSort] : queryParams.sortBys;

      const newQueryParams = queryParams.replace({
        query: cleanedQuery,
        aggregateFields,
        aggregateSortBys,
        sortBys,
        mode: seerQuery.mode,
      });

      // Build encoded metric queries, updating the current metric's query params
      // and trace metric (the metric is parsed out of the agent's visualization
      // aggregate or query filters above so the panel matches what was queried).
      const hasEquation = seerEquationMetricQueries.length > 0;

      // When Seer returns an equation, replace the interacted-with row with
      // Seer's first aggregate (preserving its label/position) instead of
      // dropping it. This keeps existing equations' label references stable.
      const interactedRow = metricQueries.find(
        (mq: BaseMetricQuery) => mq.queryParams === queryParams
      );
      const seerAggregates = seerEquationMetricQueries.filter(
        mq => !mq.queryParams.visualizes.some(isVisualizeEquation)
      );
      const seerEquations = seerEquationMetricQueries.filter(mq =>
        mq.queryParams.visualizes.some(isVisualizeEquation)
      );
      const [replacementAggregate, ...extraAggregates] = seerAggregates;

      // When the interacted row is an equation, the replacement aggregate
      // needs a letter label (A, B, C…) rather than inheriting the
      // equation's ƒn label, because ƒn labels are reserved for equations
      // and will break the equation's internalExpression after labels are
      // reassigned sequentially on the next render.
      const interactedIndex = metricQueries.findIndex(
        (mq: BaseMetricQuery) => mq.queryParams === queryParams
      );
      const isInteractedEquation =
        interactedRow && isVisualizeEquation(interactedRow.queryParams.visualizes[0]!);
      let replacementAggregateLabel: string | undefined;
      if (hasEquation && isInteractedEquation && interactedIndex >= 0) {
        const aggregatesBefore = metricQueries
          .slice(0, interactedIndex)
          .filter(mq => !isVisualizeEquation(mq.queryParams.visualizes[0]!)).length;
        replacementAggregateLabel = getFunctionLabel(aggregatesBefore);
      }

      const previousRefs = getMetricReferences(metricQueries);

      let updatedMetricQueries = metricQueries.map((mq: BaseMetricQuery) => {
        if (mq.queryParams === queryParams) {
          if (hasEquation && replacementAggregate) {
            return {
              ...replacementAggregate,
              label: replacementAggregateLabel ?? mq.label,
            };
          }
          return {
            ...mq,
            metric: nextMetric,
            queryParams: newQueryParams,
          };
        }
        return mq;
      });

      // Re-resolve existing equations' yAxis against the updated reference
      // map so charts query the new aggregate. Preserve the original
      // internalExpression exactly — syncEquationMetricQueries round-trips
      // it through unresolveExpression which can alter whitespace/ordering.
      const nextRefs = getMetricReferences(updatedMetricQueries);
      const synced = syncEquationMetricQueries(
        updatedMetricQueries,
        previousRefs,
        nextRefs
      );
      updatedMetricQueries = synced.map((mq, i) => {
        const original = updatedMetricQueries[i];
        if (mq === original) {
          return mq;
        }
        const origViz = original?.queryParams.visualizes[0];
        const syncedViz = mq.queryParams.visualizes[0];
        if (!origViz || !syncedViz || !isVisualizeEquation(origViz)) {
          return mq;
        }
        return {
          ...mq,
          queryParams: mq.queryParams.replace({
            aggregateFields: mq.queryParams.aggregateFields.map(field =>
              isVisualize(field) && isVisualizeEquation(field)
                ? field.replace({internalExpression: origViz.internalExpression})
                : field
            ),
          }),
        };
      });

      const newEncodedMetrics = updatedMetricQueries
        .map((mq: BaseMetricQuery) => encodeMetricQueryParams(mq))
        .filter(Boolean);

      // Build a single remap table for ALL of Seer's aggregates so the
      // equation's internalExpression references the correct final labels.
      // The first aggregate (A) replaces the interacted row, so it maps to
      // the interacted label. The remaining aggregates are spliced at the
      // insertion offset, so they get sequential labels from there.
      const eqStartIdx = newEncodedMetrics.findIndex(e => e.includes(EQUATION_PREFIX));
      const insertionOffset = eqStartIdx === -1 ? newEncodedMetrics.length : eqStartIdx;

      const fullRemap: Record<string, string> = {};
      const remapLabel = replacementAggregateLabel ?? interactedRow?.label;
      if (hasEquation && remapLabel) {
        fullRemap[getFunctionLabel(0)] = remapLabel;
      }
      for (let i = 0; i < extraAggregates.length; i++) {
        fullRemap[getFunctionLabel(i + 1)] = getFunctionLabel(insertionOffset + i);
      }

      const allSeerQueries = [...extraAggregates, ...seerEquations];
      const remappedSeerQueries = remapEquationLabels(allSeerQueries, 0, fullRemap);

      const spliceResult = spliceEquationQueries(newEncodedMetrics, remappedSeerQueries);

      const selection = {
        ...pageFilters.selection,
        datetime: seerQuery.datetime,
      };

      askSeerSuggestedQueryRef.current = JSON.stringify({
        selection,
        query: cleanedQuery,
        groupBys: seerQuery.groupBys,
        mode: seerQuery.mode,
        interval: seerQuery.interval,
      });

      trackAnalytics('ai_query.applied', {
        organization,
        area: analyticsArea,
        query: cleanedQuery,
        group_by_count: seerQuery.groupBys.length,
        visualize_count: seerQuery.visualizes.length,
      });

      if (runId !== undefined) {
        setRunId(runId);
      }

      const navigateWithMetrics = (encodedMetrics: string[]) => {
        // Single navigate with both metric params and datetime — previously
        // setQueryParams and navigate were separate calls, and the second
        // navigate overwrote the first with stale location.
        navigate(
          {
            ...location,
            query: {
              ...omit(location.query, ALL_DATE_TIME_QUERY_KEYS),
              ...(projectIds?.length ? {project: projectIds.map(String)} : {}),
              metric: encodedMetrics,
              start: seerQuery.datetime.start,
              end: seerQuery.datetime.end,
              statsPeriod: seerQuery.datetime.period,
              utc: seerQuery.datetime.utc,
              // Only override the interval when Seer suggested one, otherwise
              // leave the user's current interval untouched.
              ...(seerQuery.interval ? {interval: seerQuery.interval} : {}),
            },
          },
          {replace: true, preventScrollReset: true}
        );
      };

      if (spliceResult === 'requires_clear') {
        openConfirmModal({
          header: t('Clear Queries'),
          message: t(
            "This equation needs an additional %s queries but, there isn't enough room. Clear existing queries to make room?",
            remappedSeerQueries.length
          ),
          confirmText: t('Clear and apply'),
          isDangerous: true,
          onConfirm: () => {
            navigateWithMetrics(encodeEquationMetricQueries(seerEquationMetricQueries));
          },
        });
        return;
      }

      navigateWithMetrics(newEncodedMetrics);
    },
    [
      analyticsArea,
      askSeerSuggestedQueryRef,
      location,
      metricQueries,
      navigate,
      organization,
      pageFilters.selection,
      projects,
      queryParams,
      setRunId,
      traceMetric,
    ]
  );

  const usePollingEndpoint =
    organization.features.includes('gen-ai-search-agent-translate') &&
    organization.features.includes('gen-ai-explore-metrics-search');

  const transformResponse = useCallback(
    (response: AskSeerSearchQuery): AskSeerSearchQuery[] =>
      transformSeerResponse(
        response,
        responseItem => mapSeerResponseItem(responseItem),
        selectedProjectIds
      ),
    [selectedProjectIds]
  );

  if (!enableAISearch) {
    return null;
  }

  if (usePollingEndpoint) {
    return (
      <AskSeerPollingComboBox<AskSeerSearchQuery>
        initialQuery={initialSeerQuery}
        projectIds={selectedProjectIds}
        strategy="Metrics"
        options={{
          metric_context: {
            metric_name: traceMetric.name,
            metric_type: traceMetric.type,
            metric_unit: traceMetric.unit ?? NONE_UNIT,
          },
        }}
        applySeerSearchQuery={applySeerSearchQuery}
        transformResponse={transformResponse}
        fallbackMutationOptions={metricsTabAskSeerMutationOptions}
      />
    );
  }

  return (
    <AskSeerComboBox
      initialQuery={initialSeerQuery}
      askSeerMutationOptions={metricsTabAskSeerMutationOptions}
      applySeerSearchQuery={applySeerSearchQuery}
    />
  );
}
