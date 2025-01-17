import type {Dispatch, ReactNode} from 'react';
import {useCallback, useReducer} from 'react';
import type {Location} from 'history';

import type {Organization} from 'sentry/types/organization';
import {browserHistory} from 'sentry/utils/browserHistory';
import localStorage from 'sentry/utils/localStorage';
import {MEPDataProvider} from 'sentry/utils/performance/contexts/metricsEnhancedPerformanceDataContext';
import {decodeScalar} from 'sentry/utils/queryString';
import useOrganization from 'sentry/utils/useOrganization';

import {createDefinedContext} from './utils';

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

export const METRIC_SETTING_PARAM = 'metricSetting';
export const METRIC_SEARCH_SETTING_PARAM = 'metricSearchSetting'; // TODO: Clean this up since we don't need multiple params in practice.

const storageKey = 'performance.metrics-enhanced-setting';
export class MEPSetting {
  static get(): MEPState | null {
    const value = localStorage.getItem(storageKey);
    if (value) {
      if (!(value in MEPState)) {
        localStorage.removeItem(storageKey);
        return null;
      }
      // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      return MEPState[value];
    }
    return null;
  }

  static set(value: MEPState) {
    localStorage.setItem(storageKey, value);
  }
}

export function canUseMetricsDevUI(organization: Organization) {
  return organization.features.includes('performance-use-metrics');
}

export function canUseMetricsData(organization: Organization) {
  const isDevFlagOn = canUseMetricsDevUI(organization); // Forces metrics data on as well.
  const isInternalViewOn = organization.features.includes(
    'performance-transaction-name-only-search'
  );
  const samplingFeatureFlag = organization.features.includes('dynamic-sampling'); // Exists on AM2 plans only.
  const isRollingOut =
    samplingFeatureFlag && organization.features.includes('mep-rollout-flag');

  // For plans transitioning from AM2 to AM3, we still want to show metrics
  // until 90d after 100% transaction ingestion to avoid spikes in charts
  // coming from old sampling rates.
  const isTransitioningPlan = organization.features.includes(
    'dashboards-metrics-transition'
  );

  return isDevFlagOn || isInternalViewOn || isRollingOut || isTransitioningPlan;
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

  const isControlledMEP = typeof _hasMEPState !== 'undefined';

  const [_metricSettingState, _setMetricSettingState] = useReducer(
    (_: MEPState, next: MEPState) => next,
    metricSettingFromParam
  );

  const setMetricSettingState = useCallback(
    (settingState: MEPState) => {
      if (!location) {
        return;
      }
      browserHistory.replace({
        ...location,
        query: {
          ...location.query,
          [METRIC_SETTING_PARAM]: settingState,
        },
      });
      _setMetricSettingState(settingState);
    },
    [location, _setMetricSettingState]
  );

  const [autoSampleState, setAutoSampleState] = useReducer(
    (_: AutoSampleState, next: AutoSampleState) => next,
    AutoSampleState.UNSET
  );

  const metricSettingState = isControlledMEP ? _hasMEPState : _metricSettingState;

  const shouldQueryProvideMEPAutoParams =
    canUseMEP && metricSettingState === MEPState.AUTO;
  const shouldQueryProvideMEPMetricParams =
    canUseMEP && metricSettingState === MEPState.METRICS_ONLY;
  const shouldQueryProvideMEPTransactionParams =
    canUseMEP && metricSettingState === MEPState.TRANSACTIONS_ONLY;

  const memoizationKey = `${metricSettingState}`;

  return (
    <_MEPSettingProvider
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
    </_MEPSettingProvider>
  );
}

export const useMEPSettingContext = _useMEPSettingContext;
