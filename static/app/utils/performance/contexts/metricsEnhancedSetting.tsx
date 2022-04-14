import {Dispatch, ReactNode, useReducer} from 'react';

import localStorage from 'sentry/utils/localStorage';
import useOrganization from 'sentry/utils/useOrganization';

import {createDefinedContext} from './utils';

export interface MetricsEnhancedSettingContext {
  autoSampleState: AutoSampleState;
  hideSinceMetricsOnly: boolean;
  memoizationKey: string;
  metricSettingState: MEPState | null;
  setAutoSampleState: Dispatch<AutoSampleState>;
  setMetricSettingState: Dispatch<MEPState>;
  shouldQueryProvideMEPMetricParams: boolean;
  shouldQueryProvideMEPParams: boolean;
  shouldQueryProvideMEPTransactionParams: boolean;
}

const [_MEPSettingProvider, _useMEPSettingContext, _MEPSettingContext] =
  createDefinedContext<MetricsEnhancedSettingContext>({
    name: 'MetricsEnhancedSettingContext',
  });

export const MEPConsumer = _MEPSettingContext.Consumer;

/**
 * These will be called something else in the copy, but functionally the data is coming from metrics / transactions.
 * "Unset" should be the initial state before any queries return for the first time.
 */
export enum AutoSampleState {
  unset = 'unset',
  metrics = 'metrics',
  transactions = 'transactions',
}

/**
 * Metrics/transactions will be called something else in the copy, but functionally the data is coming from metrics / transactions.
 */
export enum MEPState {
  auto = 'auto',
  metricsOnly = 'metricsOnly',
  transactionsOnly = 'transactionsOnly',
}

const storageKey = 'performance.metrics-enhanced-setting';
export class MEPSetting {
  static get(): MEPState | null {
    const value = localStorage.getItem(storageKey);
    if (value) {
      if (!(value in MEPState)) {
        localStorage.removeItem(storageKey);
        return null;
      }
      return MEPState[value];
    }
    return null;
  }

  static set(value: MEPState) {
    localStorage.setItem(storageKey, value);
  }
}

export const MEPSettingProvider = ({
  children,
  _hasMEPState,
}: {
  children: ReactNode;
  _hasMEPState?: MEPState;
}) => {
  const organization = useOrganization();
  const canUseMEP = organization.features.includes('performance-use-metrics');

  const isControlledMEP = typeof _hasMEPState !== 'undefined';

  const [_metricSettingState, setMetricSettingState] = useReducer(
    (_: MEPState, next: MEPState) => next,
    MEPState.auto
  );
  const [autoSampleState, setAutoSampleState] = useReducer(
    (_: AutoSampleState, next: AutoSampleState) => next,
    AutoSampleState.unset
  );

  const metricSettingState = isControlledMEP ? _hasMEPState : _metricSettingState;

  const hideSinceMetricsOnly =
    canUseMEP &&
    (metricSettingState === MEPState.metricsOnly || metricSettingState === MEPState.auto); // TODO(k-fish): Change this so auto includes data state.
  const shouldQueryProvideMEPParams = canUseMEP && metricSettingState === MEPState.auto;
  const shouldQueryProvideMEPMetricParams =
    canUseMEP && metricSettingState === MEPState.metricsOnly;
  const shouldQueryProvideMEPTransactionParams =
    canUseMEP && metricSettingState === MEPState.transactionsOnly;

  const memoizationKey = `${metricSettingState}`;

  return (
    <_MEPSettingProvider
      value={{
        autoSampleState,
        metricSettingState,
        hideSinceMetricsOnly,
        shouldQueryProvideMEPParams,
        shouldQueryProvideMEPMetricParams,
        shouldQueryProvideMEPTransactionParams,
        memoizationKey,
        setMetricSettingState,
        setAutoSampleState,
      }}
    >
      {children}
    </_MEPSettingProvider>
  );
};

export const useMEPSettingContext = _useMEPSettingContext;
