import {MetricsEnhancedSettingContext} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {getMEPQueryParams} from 'sentry/views/performance/landing/widgets/utils';
import {DisplayModes} from 'sentry/views/performance/transactionSummary/utils';

const DISPLAY_MAP_DENY_LIST = [DisplayModes.TREND];

export function getTransactionMEPParamsIfApplicable(
  mepContext: MetricsEnhancedSettingContext,
  display: DisplayModes
) {
  if (DISPLAY_MAP_DENY_LIST.includes(display)) {
    return undefined;
  }
  return getMEPQueryParams(mepContext);
}
