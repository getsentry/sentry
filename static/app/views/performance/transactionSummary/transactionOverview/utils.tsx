import {Location} from 'history';

import {Organization} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {AggregationKeyWithAlias, QueryFieldValue} from 'sentry/utils/discover/fields';
import {MetricsCardinalityContext} from 'sentry/utils/performance/contexts/metricsCardinality';
import {MetricsEnhancedPerformanceDataContext} from 'sentry/utils/performance/contexts/metricsEnhancedPerformanceDataContext';
import {
  canUseMetricsData,
  MetricsEnhancedSettingContext,
} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {getMEPQueryParams} from 'sentry/views/performance/landing/widgets/utils';

export function canUseTransactionMetricsData(
  organization: Organization,
  mepDataContext: MetricsEnhancedPerformanceDataContext
) {
  const isUsingMetrics = canUseMetricsData(organization);

  if (!isUsingMetrics) {
    return false;
  }

  if (mepDataContext.isMetricsData === false) {
    return false;
  }

  return true;
}

export function getTransactionMEPParamsIfApplicable(
  mepSetting: MetricsEnhancedSettingContext,
  mepCardinality: MetricsCardinalityContext,
  organization: Organization
) {
  if (!canUseMetricsData(organization)) {
    return undefined;
  }

  if (mepCardinality.outcome?.forceTransactionsOnly) {
    return undefined;
  }

  return getMEPQueryParams(mepSetting, true);
}

export function getUnfilteredTotalsEventView(
  eventView: EventView,
  location: Location,
  fields: AggregationKeyWithAlias[]
): EventView {
  const totalsColumns: QueryFieldValue[] = fields.map(field => ({
    kind: 'function',
    function: [field, '', undefined, undefined],
  }));

  const transactionName = decodeScalar(location.query.transaction);
  const conditions = new MutableSearch('');

  conditions.setFilterValues('event.type', ['transaction']);
  if (transactionName) {
    conditions.setFilterValues('transaction', [transactionName]);
  }

  const unfilteredEventView = eventView.withColumns([...totalsColumns]);
  unfilteredEventView.query = conditions.formatString();

  return unfilteredEventView;
}
