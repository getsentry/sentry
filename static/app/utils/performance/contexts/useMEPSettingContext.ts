import type {Dispatch} from 'react';
import {createContext, useContext} from 'react';

import type {Organization} from 'sentry/types/organization';

export interface MetricsEnhancedSettingContext {
  autoSampleState: AutoSampleState;
  memoizationKey: string;
  metricSettingState: MEPState | null;
  setAutoSampleState: Dispatch<AutoSampleState>;
  setMetricSettingState: Dispatch<MEPState>;
  shouldQueryProvideMEPAutoParams: boolean;
  shouldQueryProvideMEPMetricParams: boolean;
  shouldQueryProvideMEPTransactionParams: boolean;
}

export const MEPSettingContext = createContext<MetricsEnhancedSettingContext | undefined>(
  undefined
);

export function useMEPSettingContext(): MetricsEnhancedSettingContext {
  const context = useContext(MEPSettingContext);
  if (context === undefined) {
    throw new Error(
      'useContext for "MetricsEnhancedSettingContext" must be inside a Provider with a value'
    );
  }
  return context;
}

export const MEPConsumer = MEPSettingContext.Consumer;

/**
 * These will be called something else in the copy, but functionally the data is coming from metrics / transactions.
 * "Unset" should be the initial state before any queries return for the first time.
 */
export enum AutoSampleState {
  UNSET = 'unset',
  METRICS = 'metrics',
  TRANSACTIONS = 'transactions',
}

/**
 * Metrics/transactions will be called something else in the copy, but functionally the data is coming from metrics / transactions.
 */
export enum MEPState {
  AUTO = 'auto',
  METRICS_ONLY = 'metricsOnly',
  TRANSACTIONS_ONLY = 'transactionsOnly',
}

export function canUseMetricsData(organization: Organization) {
  const isRollingOut = organization.features.includes('dynamic-sampling'); // Exists on AM2 plans only.

  // For plans transitioning from AM2 to AM3, we still want to show metrics
  // until 90d after 100% transaction ingestion to avoid spikes in charts
  // coming from old sampling rates.
  const isTransitioningPlan = organization.features.includes(
    'dashboards-metrics-transition'
  );

  return isRollingOut || isTransitioningPlan;
}
