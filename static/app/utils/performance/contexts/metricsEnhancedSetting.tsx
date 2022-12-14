import {Dispatch, ReactNode, useCallback, useReducer} from 'react';
import {browserHistory} from 'react-router';
import {Location} from 'history';

import {Organization} from 'sentry/types';
import localStorage from 'sentry/utils/localStorage';
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
  ); // TODO: Swap this flag out.

  const samplingRolloutFlag = organization.features.includes('dynamic-sampling');
  const isRollingOut =
    samplingRolloutFlag && organization.features.includes('mep-rollout-flag');

  return isDevFlagOn || isInternalViewOn || isRollingOut;
}

export const MEPSettingProvider = ({
  children,
  location,
  _hasMEPState,
  forceTransactions,
}: {
  children: ReactNode;
  _hasMEPState?: MEPState;
  forceTransactions?: boolean;
  location?: Location;
}) => {
  const organization = useOrganization();

  const canUseMEP = canUseMetricsData(organization);

  const allowedStates = [MEPState.metricsOnly, MEPState.transactionsOnly];
  const _metricSettingFromParam = location
    ? decodeScalar(location.query[METRIC_SETTING_PARAM])
    : MEPState.metricsOnly;
  let defaultMetricsState = MEPState.metricsOnly;

  if (forceTransactions) {
    defaultMetricsState = MEPState.transactionsOnly;
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
    AutoSampleState.unset
  );

  const metricSettingState = isControlledMEP ? _hasMEPState : _metricSettingState;

  const shouldQueryProvideMEPAutoParams =
    canUseMEP && metricSettingState === MEPState.auto;
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
        shouldQueryProvideMEPAutoParams,
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
