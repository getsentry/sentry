import type {Location} from 'history';

import type {Organization} from 'sentry/types/organization';
import EventView from 'sentry/utils/discover/eventView';
import {isAggregateField} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import type {MetricsCardinalityContext} from 'sentry/utils/performance/contexts/metricsCardinality';
import type {MetricsEnhancedPerformanceDataContext} from 'sentry/utils/performance/contexts/metricsEnhancedPerformanceDataContext';
import type {MetricsEnhancedSettingContext} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {canUseMetricsData} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
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

export function generateTransactionOverviewEventView({
  location,
  transactionName,
  shouldUseEAP,
}: {
  location: Location;
  shouldUseEAP: boolean;
  transactionName: string;
}): EventView {
  // Use the user supplied query but overwrite any transaction or event type
  // conditions they applied.

  const query = decodeScalar(location.query.query, '');
  const conditions = new MutableSearch(query);

  if (shouldUseEAP) {
    conditions.setFilterValues('is_transaction', ['true']);
    conditions.setFilterValues(
      'transaction.method',
      conditions.getFilterValues('http.method')
    );
    conditions.removeFilter('http.method');
  } else {
    conditions.setFilterValues('event.type', ['transaction']);
  }
  conditions.setFilterValues('transaction', [transactionName]);

  Object.keys(conditions.filters).forEach(field => {
    if (isAggregateField(field)) {
      conditions.removeFilter(field);
    }
  });

  const fields = shouldUseEAP
    ? [
        'id',
        'user.email',
        'user.username',
        'user.id',
        'user.ip',
        'span.duration',
        'trace',
        'timestamp',
      ]
    : ['id', 'user.display', 'transaction.duration', 'trace', 'timestamp'];

  return EventView.fromNewQueryWithLocation(
    {
      id: undefined,
      version: 2,
      name: transactionName,
      fields,
      query: conditions.formatString(),
      projects: [],
      dataset: shouldUseEAP ? DiscoverDatasets.SPANS : undefined,
    },
    location
  );
}
