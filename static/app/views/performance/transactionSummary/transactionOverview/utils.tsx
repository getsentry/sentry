import {Location} from 'history';

import {MetricsEnhancedSettingContext} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {decodeScalar} from 'sentry/utils/queryString';
import {getMEPQueryParams} from 'sentry/views/performance/landing/widgets/utils';
import {DisplayModes} from 'sentry/views/performance/transactionSummary/utils';

const DISPLAY_MAP_DENY_LIST = [DisplayModes.TREND];

export function getTransactionMEPParamsIfApplicable(
  mepContext: MetricsEnhancedSettingContext,
  location: Location
) {
  const display = decodeScalar(
    location.query.display,
    DisplayModes.DURATION
  ) as DisplayModes;
  const breakdown = decodeScalar(location.query.breakdown, '');
  const query = decodeScalar(location.query.query, '');

  // certain charts aren't compatible with metrics
  if (DISPLAY_MAP_DENY_LIST.includes(display)) {
    return undefined;
  }

  // span op breakdown filters aren't compatible with metrics
  if (breakdown) {
    return undefined;
  }

  // in the short term, using any filter will force indexed event search
  if (query) {
    return undefined;
  }

  return getMEPQueryParams(mepContext);
}
