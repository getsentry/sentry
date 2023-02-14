import {Location} from 'history';

import {Organization} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {AggregationKeyWithAlias, QueryFieldValue} from 'sentry/utils/discover/fields';
import {
  canUseMetricsData,
  MetricsEnhancedSettingContext,
} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {getMEPQueryParams} from 'sentry/views/performance/landing/widgets/utils';
import {DisplayModes} from 'sentry/views/performance/transactionSummary/utils';

export const DISPLAY_MAP_DENY_LIST = [DisplayModes.TREND, DisplayModes.LATENCY];

export function canUseTransactionMetricsData(organization, location) {
  const isUsingMetrics = canUseMetricsData(organization);

  if (!isUsingMetrics) {
    return false;
  }

  // span op breakdown filters aren't compatible with metrics
  const breakdown = decodeScalar(location.query.breakdown, '');
  if (breakdown) {
    return false;
  }

  // in the short term, using any filter will force indexed event search
  const query = decodeScalar(location.query.query, '');
  if (query) {
    return false;
  }

  return true;
}

export function queryCompatibleWithMetrics(location) {
  // span op breakdown filters aren't compatible with metrics
  const breakdown = decodeScalar(location.query.breakdown, '');
  if (breakdown) {
    return false;
  }

  // in the short term, using any filter will force indexed event search
  const query = decodeScalar(location.query.query, '');
  if (query) {
    return false;
  }

  return true;
}

export function getTransactionMEPParamsIfApplicable(
  mepContext: MetricsEnhancedSettingContext,
  organization: Organization,
  location: Location,
  unfiltered: boolean = false
) {
  if (!organization.features.includes('performance-metrics-backed-transaction-summary')) {
    return undefined;
  }

  // TODO clean this up
  // still fetches indexed event count in the tooltip
  if (unfiltered && !queryCompatibleWithMetrics(location)) {
    return undefined;
  }

  if (!unfiltered && !canUseTransactionMetricsData(organization, location)) {
    return undefined;
  }

  return getMEPQueryParams(mepContext);
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
