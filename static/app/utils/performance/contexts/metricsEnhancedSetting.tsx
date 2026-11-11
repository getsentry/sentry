import type {ReactNode} from 'react';
import {useCallback, useReducer} from 'react';
import type {Location} from 'history';
import {parseAsString, useQueryState} from 'nuqs';

import {useOrganization} from 'sentry/utils/useOrganization';

import {MEPDataProvider} from './metricsEnhancedPerformanceDataContext';
import {
  MEPSettingContext,
  AutoSampleState,
  MEPState,
  canUseMetricsData,
} from './useMEPSettingContext';

const METRIC_SETTING_PARAM = 'metricSetting';

export function MEPSettingProvider({
  children,
  location,
  forceTransactions,
}: {
  children: ReactNode;
  forceTransactions?: boolean;
  location?: Location;
}) {
  const organization = useOrganization();
  const [metricSettingParam, setMetricSettingParam] = useQueryState(
    METRIC_SETTING_PARAM,
    parseAsString
  );

  const canUseMEP = canUseMetricsData(organization);

  const allowedStates = [MEPState.METRICS_ONLY, MEPState.TRANSACTIONS_ONLY];
  const _metricSettingFromParam = location ? metricSettingParam : MEPState.METRICS_ONLY;
  let defaultMetricsState = MEPState.METRICS_ONLY;

  if (forceTransactions) {
    defaultMetricsState = MEPState.TRANSACTIONS_ONLY;
  }

  const metricSettingFromParam =
    allowedStates.find(s => s === _metricSettingFromParam) ?? defaultMetricsState;

  const [_metricSettingState, _setMetricSettingState] = useReducer(
    (_: MEPState, next: MEPState) => next,
    metricSettingFromParam
  );

  const setMetricSettingState = useCallback(
    (settingState: MEPState) => {
      if (!location) {
        return;
      }
      setMetricSettingParam(settingState);
      _setMetricSettingState(settingState);
    },
    [location, setMetricSettingParam, _setMetricSettingState]
  );

  const [autoSampleState, setAutoSampleState] = useReducer(
    (_: AutoSampleState, next: AutoSampleState) => next,
    AutoSampleState.UNSET
  );

  const metricSettingState = _metricSettingState;

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
