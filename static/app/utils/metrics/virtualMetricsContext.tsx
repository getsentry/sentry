import {createContext, useCallback, useContext, useMemo} from 'react';

import type {
  MetricAggregation,
  MetricMeta,
  MetricsExtractionCondition,
  MetricsExtractionRule,
  MRI,
} from 'sentry/types/metrics';
import {
  aggregationToMetricType,
  BUILT_IN_CONDITION_ID,
} from 'sentry/utils/metrics/extractionRules';
import {DEFAULT_MRI, formatMRI, parseMRI} from 'sentry/utils/metrics/mri';
import type {MetricTag} from 'sentry/utils/metrics/types';
import {useMetricsMeta} from 'sentry/utils/metrics/useMetricsMeta';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

const Context = createContext<{
  getAggregations: (mri: MRI, conditionId: number) => MetricAggregation[];
  getCondition: (mri: MRI, conditionId: number) => MetricsExtractionCondition | null;
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
  getAggregations: () => [],
  getVirtualMRI: () => null,
  getVirtualMeta: () => {
    throw new Error('Not implemented');
  },
  getConditions: () => [],
  getCondition: () => null,
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

export function createVirtualMRI(rule: MetricsExtractionRule): MRI {
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

  const extractionRulesQuery = useApiQuery<MetricsExtractionRule[]>(
    getMetricsExtractionRulesApiKey(organization.slug, selection.projects),
    {staleTime: 0, enabled: isReady}
  );
  const spanMetaQuery = useMetricsMeta(selection, ['spans']);

  const extractionRules = extractionRulesQuery.data ?? EMPTY_ARRAY;
  const isLoading = extractionRulesQuery.isLoading || spanMetaQuery.isLoading;

  const extractionRulesWithBuiltIn = useMemo(() => {
    return extractionRules.map(rule => {
      const matchingBuiltInMetric = spanMetaQuery.data.find(
        meta => formatMRI(meta.mri) === rule.spanAttribute
      );
      if (!matchingBuiltInMetric) {
        return rule;
      }
      return {
        ...rule,
        conditions: [
          {
            id: BUILT_IN_CONDITION_ID,
            mris: [matchingBuiltInMetric.mri],
            value: '',
          },
          ...rule.conditions,
        ],
      };
    });
  }, [extractionRules, spanMetaQuery.data]);

  const mriToVirtualMap = useMemo(
    () => createMRIToVirtualMap(extractionRulesWithBuiltIn),
    [extractionRulesWithBuiltIn]
  );

  const virtualMRIToRuleMap = useMemo(
    () =>
      new Map<MRI, MetricsExtractionRule>(
        extractionRulesWithBuiltIn.map(rule => [createVirtualMRI(rule), rule])
      ),
    [extractionRulesWithBuiltIn]
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
      return rule?.conditions ?? [];
    },
    [virtualMRIToRuleMap]
  );

  const getCondition = useCallback(
    (mri: MRI, conditionId: number) => {
      const rule = virtualMRIToRuleMap.get(mri);
      return rule?.conditions.find(c => c.id === conditionId) || null;
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

      if (conditionId === BUILT_IN_CONDITION_ID) {
        // TODO: Do we need to check the aggregate?
        return {mri: condition.mris[0], aggregation};
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
      const rule = virtualMRIToRuleMap.get(mri) ?? null;

      if (!rule) {
        return null;
      }

      return {
        ...rule,
        // return the original rule without the built-in condition
        conditions: rule.conditions.filter(
          condition => condition.id !== BUILT_IN_CONDITION_ID
        ),
      };
    },
    [virtualMRIToRuleMap]
  );

  const getAggregations = useCallback(
    (mri: MRI, conditionId: number) => {
      if (conditionId === BUILT_IN_CONDITION_ID) {
        const condition = getCondition(mri, conditionId);
        const builtInMeta = spanMetaQuery.data.find(
          meta => meta.mri === condition?.mris[0]
        );
        return builtInMeta?.operations ?? [];
      }

      const rule = virtualMRIToRuleMap.get(mri);
      if (!rule) {
        return [];
      }
      return rule.aggregates;
    },
    [getCondition, spanMetaQuery.data, virtualMRIToRuleMap]
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
      getCondition,
      getAggregations,
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
      getCondition,
      getAggregations,
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
