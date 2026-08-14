import type {Dispatch, ReactNode} from 'react';
import {createContext, useCallback, useContext, useReducer} from 'react';
import type {Location} from 'history';

import type {Organization} from 'sentry/types/organization';
import {MEPDataProvider} from 'sentry/utils/performance/contexts/metricsEnhancedPerformanceDataContext';
import {decodeScalar} from 'sentry/utils/queryString';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';

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

const MEPSettingContext = createContext<MetricsEnhancedSettingContext | undefined>(
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

const METRIC_SETTING_PARAM = 'metricSetting';
export const METRIC_SEARCH_SETTING_PARAM = 'metricSearchSetting'; // TODO: Clean this up since we don't need multiple params in practice.

export function canUseMetricsData(_organization: Organization) {
  // Generic metrics performance data is no longer used for landing pages,
  // dashboards, or other MEP UI. Always query the transactions dataset.
  return false;
}

export function MEPSettingProvider({
  children,
  location,
  _hasMEPState,
  forceTransactions,
}: {
  children: ReactNode;
  _hasMEPState?: MEPState;
  forceTransactions?: boolean;
  location?: Location;
}) {
  const organization = useOrganization();
  const navigate = useNavigate();

  const canUseMEP = canUseMetricsData(organization);

  const allowedStates = [MEPState.METRICS_ONLY, MEPState.TRANSACTIONS_ONLY];
  const _metricSettingFromParam = location
    ? decodeScalar(location.query[METRIC_SETTING_PARAM])
    : MEPState.METRICS_ONLY;
  let defaultMetricsState = MEPState.METRICS_ONLY;

  if (forceTransactions) {
    defaultMetricsState = MEPState.TRANSACTIONS_ONLY;
  }

  const metricSettingFromParam =
    allowedStates.find(s => s === _metricSettingFromParam) ?? defaultMetricsState;

  const isControlledMEP = _hasMEPState !== undefined;

  const [_metricSettingState, _setMetricSettingState] = useReducer(
    (_: MEPState, next: MEPState) => next,
    metricSettingFromParam
  );

  const setMetricSettingState = useCallback(
    (settingState: MEPState) => {
      if (!location) {
        return;
      }
      navigate(
        {
          ...location,
          query: {
            ...location.query,
            [METRIC_SETTING_PARAM]: settingState,
          },
        },
        {replace: true}
      );
      _setMetricSettingState(settingState);
    },
    [location, navigate, _setMetricSettingState]
  );

  const [autoSampleState, setAutoSampleState] = useReducer(
    (_: AutoSampleState, next: AutoSampleState) => next,
    AutoSampleState.UNSET
  );

  // When metrics are unavailable, always stay on the transactions path even if a
  // caller tries to force metrics-only via props or query params.
  const metricSettingState = canUseMEP
    ? isControlledMEP
      ? _hasMEPState
      : _metricSettingState
    : MEPState.TRANSACTIONS_ONLY;

  const shouldQueryProvideMEPAutoParams =
    canUseMEP && metricSettingState === MEPState.AUTO;
  const shouldQueryProvideMEPMetricParams =
    canUseMEP && metricSettingState === MEPState.METRICS_ONLY;
  const shouldQueryProvideMEPTransactionParams =
    canUseMEP && metricSettingState === MEPState.TRANSACTIONS_ONLY;

  const memoizationKey = metricSettingState;

  return (
    <MEPSettingContext
      value={{
        autoSampleState,
        metricSettingState,
        shouldQueryProvideMEPAutoParams,
        shouldQueryProvideMEPMetricParams,
        shouldQueryProvideMEPTransactionParams,
        memoizationKey,
        setMetricSettingState,
        setAutoSampleState,
      }}
    >
      <MEPDataProvider>{children}</MEPDataProvider>
    </MEPSettingContext>
  );
}
