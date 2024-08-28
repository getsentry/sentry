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

interface ContextType {
  getAggregations: (mri: MRI, conditionId: number) => MetricAggregation[];
  getCondition: (mri: MRI, conditionId: number) => MetricsExtractionCondition | null;
  getConditions: (mri: MRI) => MetricsExtractionCondition[];
  getExtractionRule: (mri: MRI, conditionId: number) => MetricsExtractionRule | null;
  getExtractionRules: (mri: MRI) => MetricsExtractionRule[];
  getTags: (mri: MRI, conditionId: number) => MetricTag[];
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
}

const Context = createContext<ContextType>({
  getAggregations: () => [],
  getVirtualMRI: () => null,
  getVirtualMeta: () => {
    throw new Error('Not implemented');
  },
  getConditions: () => [],
  getCondition: () => null,
  getExtractionRule: () => null,
  getExtractionRules: () => [],
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
  return `v:custom/${rule.spanAttribute}@none`;
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

function stripBuiltInCondition(rule: MetricsExtractionRule): MetricsExtractionRule {
  return {
    ...rule,
    conditions: rule.conditions.filter(
      condition => condition.id !== BUILT_IN_CONDITION_ID
    ),
  };
}

export function VirtualMetricsContextProvider({children}: Props) {
  const organization = useOrganization();
  const {selection, isReady} = usePageFilters();

  const extractionRulesQuery = useApiQuery<MetricsExtractionRule[]>(
    getMetricsExtractionRulesApiKey(organization.slug, selection.projects),
    {staleTime: 0, enabled: isReady}
  );
  const spanMetaQuery = useMetricsMeta(selection, ['spans']);

  const extractionRules = extractionRulesQuery.data ?? EMPTY_ARRAY;
  const isLoading = extractionRulesQuery.isPending || spanMetaQuery.isLoading;

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

  const virtualMRIToRuleMap = useMemo(() => {
    const map = new Map<MRI, MetricsExtractionRule[]>();
    extractionRulesWithBuiltIn.forEach(rule => {
      const virtualMRI = createVirtualMRI(rule);
      const existingRules = map.get(virtualMRI) || [];
      map.set(virtualMRI, [...existingRules, rule]);
    });
    return map;
  }, [extractionRulesWithBuiltIn]);

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
      const rules = virtualMRIToRuleMap.get(mri);
      if (!rules) {
        throw new Error('Rules not found');
      }

      return {
        type: 'v',
        unit: 'none',
        blockingStatus: [],
        mri: mri,
        operations: [],
        projectIds: rules.map(rule => rule.projectId),
      };
    },
    [virtualMRIToRuleMap]
  );

  const getConditions = useCallback(
    (mri: MRI): MetricsExtractionCondition[] => {
      const rules = virtualMRIToRuleMap.get(mri);

      const conditions = rules?.flatMap(rule => rule.conditions) ?? [];

      // Unique by id
      return Array.from(
        new Map(conditions.map(condition => [condition.id, condition])).values()
      );
    },
    [virtualMRIToRuleMap]
  );

  const getCondition = useCallback(
    (mri: MRI, conditionId: number) => {
      const conditions = getConditions(mri);
      return conditions.find(c => c.id === conditionId) || null;
    },
    [getConditions]
  );

  const getExtractionRules = useCallback(
    (mri: MRI) => {
      return virtualMRIToRuleMap.get(mri)?.map(stripBuiltInCondition) ?? [];
    },
    [virtualMRIToRuleMap]
  );

  const getExtractionRule = useCallback(
    (mri: MRI, conditionId: number) => {
      const rules = getExtractionRules(mri);

      if (!rules) {
        return null;
      }

      const rule = rules.find(r => r.conditions.some(c => c.id === conditionId));
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
    [getExtractionRules]
  );

  const getTags = useCallback(
    (mri: MRI, conditionId: number): MetricTag[] => {
      const rule = getExtractionRule(mri, conditionId);
      return rule?.tags.map(tag => ({key: tag})) || [];
    },
    [getExtractionRule]
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
      const condition = getCondition(mri, conditionId);
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
    [getCondition]
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

      const condition = getConditions(virtualMRI).find(c => c.mris.includes(mri));
      if (!condition) {
        return null;
      }

      return {
        mri: virtualMRI,
        conditionId: condition.id,
        aggregation: parseMRI(mri).type === 'c' ? 'count' : aggregation,
      };
    },
    [getVirtualMRI, getConditions]
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

      const rule = getExtractionRule(mri, conditionId);
      if (!rule) {
        return [];
      }
      return rule.aggregates;
    },
    [getCondition, getExtractionRule, spanMetaQuery.data]
  );

  const virtualMeta = useMemo(
    () => Array.from(virtualMRIToRuleMap.keys()).map(getVirtualMeta),
    [getVirtualMeta, virtualMRIToRuleMap]
  );

  const contextValue = useMemo<ContextType>(
    () => ({
      getVirtualMRI,
      getVirtualMeta,
      getConditions,
      getCondition,
      getAggregations,
      getExtractionRule,
      getExtractionRules,
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
      getExtractionRules,
      getTags,
      getVirtualMRIQuery,
      resolveVirtualMRI,
      virtualMeta,
      isLoading,
    ]
  );

  return <Context.Provider value={contextValue}>{children}</Context.Provider>;
}
