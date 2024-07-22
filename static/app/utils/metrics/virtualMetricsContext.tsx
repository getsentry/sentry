import {createContext, useCallback, useContext, useMemo} from 'react';

import type {
  MetricAggregation,
  MetricMeta,
  MetricsExtractionCondition,
  MetricsExtractionRule,
  MRI,
} from 'sentry/types/metrics';
import {aggregationToMetricType} from 'sentry/utils/metrics/extractionRules';
import {DEFAULT_MRI, parseMRI} from 'sentry/utils/metrics/mri';
import type {MetricTag} from 'sentry/utils/metrics/types';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

const Context = createContext<{
  getConditions: (mri: MRI) => MetricsExtractionCondition[];
  getExtractionRule: (mri: MRI) => MetricsExtractionRule | null;
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
  getExtractionRule: () => null,
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

function createVirtualMRI(rule: MetricsExtractionRule): MRI {
  return `v:custom/${rule.spanAttribute}|${rule.projectId}@${rule.unit}`;
}

export function createMRIToVirtualMap(rules: MetricsExtractionRule[]): Map<MRI, MRI> {
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

const getMetricsExtractionRulesApiKey = (orgSlug: string, projects: number[]) =>
  [
    `/organizations/${orgSlug}/metrics/extraction-rules/`,
    {
      query: {
        project: projects,
      },
    },
  ] as const;

const EMPTY_ARRAY: never[] = [];

export function VirtualMetricsContextProvider({children}: Props) {
  const organization = useOrganization();
  const {selection, isReady} = usePageFilters();

  const {isLoading, data = EMPTY_ARRAY} = useApiQuery<MetricsExtractionRule[]>(
    getMetricsExtractionRulesApiKey(organization.slug, selection.projects),
    {staleTime: 0, enabled: isReady}
  );

  const mriToVirtualMap = useMemo(() => createMRIToVirtualMap(data), [data]);

  const virtualMRIToRuleMap = useMemo(
    () =>
      new Map<MRI, MetricsExtractionRule>(
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

  const getExtractionRule = useCallback(
    (mri: MRI) => {
      return virtualMRIToRuleMap.get(mri) ?? null;
    },
    [virtualMRIToRuleMap]
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
      getExtractionRule,
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
      getExtractionRule,
      getTags,
      getVirtualMRIQuery,
      resolveVirtualMRI,
      virtualMeta,
      isLoading,
    ]
  );

  return <Context.Provider value={contextValue}>{children}</Context.Provider>;
}
