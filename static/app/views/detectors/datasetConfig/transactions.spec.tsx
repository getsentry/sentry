import {OrganizationFixture} from 'sentry-fixture/organization';

import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {Dataset, EventTypes} from 'sentry/views/alerts/rules/metric/types';
import {DetectorTransactionsConfig} from 'sentry/views/detectors/datasetConfig/transactions';

describe('DetectorTransactionsConfig', () => {
  describe('getSeriesQueryOptions', () => {
    const organization = OrganizationFixture();

    it('prefixes event.type:transaction and uses METRICS_ENHANCED dataset', () => {
      const key = DetectorTransactionsConfig.getSeriesQueryOptions({
        organization,
        aggregate: 'count()',
        interval: 60,
        query: 'transaction.duration:>0',
        environment: 'prod',
        projectId: '1',
        dataset: Dataset.TRANSACTIONS,
        eventTypes: [EventTypes.TRANSACTION],
        statsPeriod: '6h',
        comparisonDelta: undefined,
      });

      expect(key[0]).toBe(`/organizations/${organization.slug}/events-stats/`);
      const params = key[1]!.query!;
      expect(params.dataset).toBe(DiscoverDatasets.METRICS_ENHANCED);
      expect(params.query).toBe('transaction.duration:>0');
      expect(params.interval).toBe('1m');
      expect(params.environment).toEqual(['prod']);
      expect(params.project).toEqual(['1']);
    });

    it('expands 7d statsPeriod to 9998m for 1m intervals', () => {
      const key = DetectorTransactionsConfig.getSeriesQueryOptions({
        organization,
        aggregate: 'count()',
        interval: 60,
        query: '',
        environment: '',
        projectId: '1',
        dataset: Dataset.TRANSACTIONS,
        eventTypes: [EventTypes.TRANSACTION],
        statsPeriod: '7d',
        comparisonDelta: undefined,
      });

      const params = key[1]!.query!;
      expect(params.statsPeriod).toBe('9998m');
    });

    it('on-demand success (apdex) returns METRICS_ENHANCED and prefixed query', () => {
      const orgWithFeature = OrganizationFixture({
        features: ['on-demand-metrics-extraction', 'on-demand-metrics-ui'],
      });

      const key = DetectorTransactionsConfig.getSeriesQueryOptions({
        organization: orgWithFeature,
        aggregate: 'apdex()',
        interval: 60,
        query: 'transaction.duration:>0',
        environment: '',
        projectId: '1',
        dataset: Dataset.GENERIC_METRICS,
        eventTypes: [EventTypes.TRANSACTION],
        statsPeriod: '6h',
        comparisonDelta: undefined,
      });

      const params = key[1]!.query!;
      expect(params.dataset).toBe(DiscoverDatasets.METRICS_ENHANCED);
      expect(params.query).toBe('transaction.duration:>0');
      expect(params.interval).toBe('1m');
    });
  });
});
