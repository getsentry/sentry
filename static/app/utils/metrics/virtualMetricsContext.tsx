import {createContext, useCallback, useContext, useMemo} from 'react';

import type {
  MetricAggregation,
  MetricMeta,
  MetricsExtractionCondition,
  MetricsExtractionRule,
  MetricType,
  MRI,
} from 'sentry/types/metrics';
import {DEFAULT_MRI, parseMRI} from 'sentry/utils/metrics/mri';
import type {MetricTag} from 'sentry/utils/metrics/types';
import {useApiQueries} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {useSelectedProjects} from 'sentry/views/metrics/utils/useSelectedProjects';
import {getMetricsExtractionRulesApiKey} from 'sentry/views/settings/projectMetrics/utils/api';

interface MetricsExtractionRuleWithProject extends MetricsExtractionRule {
  projectId: number;
}

const Context = createContext<{
  getConditions: (mri: MRI) => MetricsExtractionCondition[];
  getTags: (mri: MRI) => MetricTag[];
  getVirtualMRI: (mri: MRI) => MRI | null;
  getVirtualMRIQuery: (
    mri: MRI,
    aggregation: MetricAggregation
  ) => {
    aggregation: MetricAggregation;
    conditionId: number;
    mri: MRI;
  } | null;
  getVirtualMeta: (mri: MRI) => MetricMeta;
  isLoading: boolean;
  resolveVirtualMRI: (
    mri: MRI,
    conditionId: number,
    aggregation: MetricAggregation
  ) => {aggregation: MetricAggregation; mri: MRI};
  virtualMeta: MetricMeta[];
}>({
  getVirtualMRI: () => null,
  getVirtualMeta: () => {
    throw new Error('Not implemented');
  },
  getConditions: () => [],
  getTags: () => [],
  getVirtualMRIQuery: () => null,
  resolveVirtualMRI: (mri, _, aggregation) => ({mri, aggregation}),
  virtualMeta: [],
  isLoading: false,
});

export function useVirtualMetricsContext() {
  return useContext(Context);
}

interface Props {
  children: React.ReactNode;
}

function createVirtualMRI(rule: MetricsExtractionRuleWithProject): MRI {
  return `v:custom/${rule.spanAttribute}|${rule.projectId}@${rule.unit}`;
}

export function createMRIToVirtualMap(
  rules: MetricsExtractionRuleWithProject[]
): Map<MRI, MRI> {
  const mriMap = new Map<MRI, MRI>();
  for (const rule of rules) {
    for (const condition of rule.conditions) {
      for (const mri of condition.mris) {
        mriMap.set(mri, createVirtualMRI(rule));
      }
    }
  }
  return mriMap;
}

const aggregationToMetricType: Record<MetricAggregation, MetricType> = {
  count: 'c',
  count_unique: 's',
  min: 'g',
  max: 'g',
  sum: 'g',
  avg: 'g',
  p50: 'd',
  p75: 'd',
  p95: 'd',
  p99: 'd',
};

export function VirtualMetricsContextProvider({children}: Props) {
  const organization = useOrganization();
  const projects = useSelectedProjects();

  // TODO: support querying multiple projects in the API
  const requests = useApiQueries<MetricsExtractionRule[]>(
    projects.map(project =>
      getMetricsExtractionRulesApiKey(organization.slug, project.slug)
    ),
    {staleTime: 0}
  );

  const {isLoading, data} = useMemo(
    () =>
      requests.reduce(
        (acc, request, index) => {
          acc.isLoading ||= request.isLoading;
          const rules = (request.data ?? []).map(rule => ({
            ...rule,
            projectId: Number(projects[index].id),
          }));
          acc.data = acc.data.concat(rules);

          return acc;
        },
        {
          isLoading: false,
          data: [] as MetricsExtractionRuleWithProject[],
        }
      ),
    [projects, requests]
  );

  const mriToVirtualMap = useMemo(() => createMRIToVirtualMap(data), [data]);

  const virtualMRIToRuleMap = useMemo(
    () =>
      new Map<MRI, MetricsExtractionRuleWithProject>(
        data.map(rule => [createVirtualMRI(rule), rule])
      ),
    [data]
  );

  const getVirtualMRI = useCallback(
    (mri: MRI): MRI | null => {
      const virtualMRI = mriToVirtualMap.get(mri);
      if (!virtualMRI) {
        return null;
      }
      return virtualMRI;
    },
    [mriToVirtualMap]
  );

  const getVirtualMeta = useCallback(
    (mri: MRI): MetricMeta => {
      const rule = virtualMRIToRuleMap.get(mri);
      if (!rule) {
        throw new Error('Rule not found');
      }

      return {
        type: 'v',
        unit: rule.unit,
        blockingStatus: [],
        mri: mri,
        operations: rule.aggregates,
        projectIds: [rule.projectId],
      };
    },
    [virtualMRIToRuleMap]
  );

  const getConditions = useCallback(
    (mri: MRI): MetricsExtractionCondition[] => {
      const rule = virtualMRIToRuleMap.get(mri);
      return rule?.conditions || [];
    },
    [virtualMRIToRuleMap]
  );

  const getTags = useCallback(
    (mri: MRI): MetricTag[] => {
      const rule = virtualMRIToRuleMap.get(mri);
      return rule?.tags.map(tag => ({key: tag})) || [];
    },
    [virtualMRIToRuleMap]
  );

  const resolveVirtualMRI = useCallback(
    (
      mri: MRI,
      conditionId: number,
      aggregation: MetricAggregation
    ): {
      aggregation: MetricAggregation;
      mri: MRI;
    } => {
      const rule = virtualMRIToRuleMap.get(mri);
      if (!rule) {
        return {mri: DEFAULT_MRI, aggregation: 'sum'};
      }
      const condition = rule.conditions.find(c => c.id === conditionId);
      if (!condition) {
        return {mri: DEFAULT_MRI, aggregation: 'sum'};
      }

      const metricType = aggregationToMetricType[aggregation];
      let resolvedMRI = condition.mris.find(m => m.startsWith(metricType));
      if (!resolvedMRI) {
        resolvedMRI = mri;
      }

      return {mri: resolvedMRI, aggregation: metricType === 'c' ? 'sum' : aggregation};
    },
    [virtualMRIToRuleMap]
  );

  const getVirtualMRIQuery = useCallback(
    (
      mri: MRI,
      aggregation: MetricAggregation
    ): {
      aggregation: MetricAggregation;
      conditionId: number;
      mri: MRI;
    } | null => {
      const virtualMRI = getVirtualMRI(mri);
      if (!virtualMRI) {
        return null;
      }

      const rule = virtualMRIToRuleMap.get(virtualMRI);
      if (!rule) {
        return null;
      }

      const condition = rule.conditions.find(c => c.mris.includes(mri));
      if (!condition) {
        return null;
      }

      return {
        mri: virtualMRI,
        conditionId: condition.id,
        aggregation: parseMRI(mri).type === 'c' ? 'count' : aggregation,
      };
    },
    [getVirtualMRI, virtualMRIToRuleMap]
  );

  const virtualMeta = useMemo(
    () => Array.from(virtualMRIToRuleMap.keys()).map(getVirtualMeta),
    [getVirtualMeta, virtualMRIToRuleMap]
  );

  const contextValue = useMemo(
    () => ({
      getVirtualMRI,
      getVirtualMeta,
      getConditions,
      getTags,
      getVirtualMRIQuery,
      resolveVirtualMRI,
      virtualMeta,
      isLoading,
    }),
    [
      getVirtualMRI,
      getVirtualMeta,
      getConditions,
      getTags,
      getVirtualMRIQuery,
      resolveVirtualMRI,
      virtualMeta,
      isLoading,
    ]
  );

  return (
    <Context.Provider value={contextValue}>
      {isLoading ? null : children}
    </Context.Provider>
  );
}
