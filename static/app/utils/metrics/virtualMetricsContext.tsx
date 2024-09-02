import {createContext, useContext} from 'react';

import type {
  MetricAggregation,
  MetricMeta,
  MetricsExtractionCondition,
  MetricsExtractionRule,
  MRI,
} from 'sentry/types/metrics';
import type {MetricTag} from 'sentry/utils/metrics/types';

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

// TODO: Remove this when all dependet code was cleaned up
export function useVirtualMetricsContext() {
  return useContext(Context);
}
