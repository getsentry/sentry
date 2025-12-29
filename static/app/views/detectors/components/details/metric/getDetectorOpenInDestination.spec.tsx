import {
  MetricDetectorFixture,
  SnubaQueryDataSourceFixture,
} from 'sentry-fixture/detectors';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {Dataset, EventTypes} from 'sentry/views/alerts/rules/metric/types';

import {getDetectorOpenInDestination} from './getDetectorOpenInDestination';

describe('getDetectorOpenInDestination', () => {
  const organization = OrganizationFixture({
    features: ['discover-basic', 'visibility-explore-view'],
  });

  describe('Errors dataset', () => {
    it('returns "Open in Discover" for errors dataset', () => {
      const detector = MetricDetectorFixture({
        dataSources: [
          SnubaQueryDataSourceFixture({
            queryObj: {
              id: '1',
              status: 1,
              subscription: '1',
              snubaQuery: {
                id: '1',
                aggregate: 'count()',
                dataset: Dataset.ERRORS,
                eventTypes: [EventTypes.ERROR],
                query: 'is:unresolved',
                timeWindow: 300,
                environment: 'prod',
              },
            },
          }),
        ],
      });

      const result = getDetectorOpenInDestination({
        detectorName: detector.name,
        organization,
        projectId: detector.projectId,
        snubaQuery: detector.dataSources[0].queryObj.snubaQuery,
        statsPeriod: '7d',
      });

      expect(result?.buttonText).toBe('Open in Discover');
      expect(result?.to).toEqual(
        expect.objectContaining({
          pathname: expect.stringContaining('/discover/results/'),
          query: expect.objectContaining({
            dataset: 'errors',
            query: 'event.type:error is:unresolved',
            interval: '5m',
            statsPeriod: '7d',
            project: '1',
            environment: 'prod',
          }),
        })
      );
    });
  });

  describe('Transactions dataset', () => {
    it('returns "Open in Explore" for transactions dataset', () => {
      const detector = MetricDetectorFixture({
        dataSources: [
          SnubaQueryDataSourceFixture({
            queryObj: {
              id: '1',
              status: 1,
              subscription: '1',
              snubaQuery: {
                id: '1',
                aggregate: 'p95(transaction.duration)',
                dataset: Dataset.TRANSACTIONS,
                eventTypes: [EventTypes.TRANSACTION],
                query: 'transaction:/api/users',
                timeWindow: 600,
                environment: 'prod',
              },
            },
          }),
        ],
      });

      const result = getDetectorOpenInDestination({
        detectorName: detector.name,
        organization,
        projectId: detector.projectId,
        snubaQuery: detector.dataSources[0].queryObj.snubaQuery,
        statsPeriod: '14d',
      });

      expect(result?.buttonText).toBe('Open in Explore');
      expect(result?.to).toContain('/explore/traces/');
      expect(result?.to).toContain(
        'query=is_transaction%3Atrue%20transaction%3A%2Fapi%2Fusers'
      );
      expect(result?.to).toContain('interval=10m');
      expect(result?.to).toContain('environment=prod');
      expect(result?.to).toContain(
        'visualize=%7B%22chartType%22%3A1%2C%22yAxes%22%3A%5B%22p95%28transaction.duration%29%22%5D%7D'
      );
      expect(result?.to).toContain('project=1');
    });
  });

  describe('Spans dataset', () => {
    it('returns "Open in Explore" for spans dataset', () => {
      const detector = MetricDetectorFixture({
        dataSources: [
          SnubaQueryDataSourceFixture({
            queryObj: {
              id: '1',
              status: 1,
              subscription: '1',
              snubaQuery: {
                id: '1',
                aggregate: 'count()',
                dataset: Dataset.EVENTS_ANALYTICS_PLATFORM,
                eventTypes: [],
                query: 'span.op:http',
                timeWindow: 300,
                environment: 'prod',
              },
            },
          }),
        ],
      });

      const result = getDetectorOpenInDestination({
        detectorName: detector.name,
        organization,
        projectId: detector.projectId,
        snubaQuery: detector.dataSources[0].queryObj.snubaQuery,
        statsPeriod: '7d',
      });

      expect(result?.buttonText).toBe('Open in Explore');
      expect(result?.to).toContain('/explore/traces/');
      expect(result?.to).toContain('query=span.op%3Ahttp');
      expect(result?.to).toContain('interval=5m');
      expect(result?.to).toContain('environment=prod');
      expect(result?.to).toContain(
        'visualize=%7B%22chartType%22%3A1%2C%22yAxes%22%3A%5B%22count%28%29%22%5D%7D'
      );
      expect(result?.to).toContain('project=1');
    });

    describe('Logs', () => {
      it('returns "Open in Logs" with correct query parameters', () => {
        const detector = MetricDetectorFixture({
          dataSources: [
            SnubaQueryDataSourceFixture({
              queryObj: {
                id: '1',
                status: 1,
                subscription: '1',
                snubaQuery: {
                  id: '1',
                  aggregate: 'count()',
                  dataset: Dataset.EVENTS_ANALYTICS_PLATFORM,
                  eventTypes: [EventTypes.TRACE_ITEM_LOG],
                  query: 'log.level:error',
                  timeWindow: 300,
                  environment: 'prod',
                },
              },
            }),
          ],
        });

        const result = getDetectorOpenInDestination({
          detectorName: detector.name,
          organization,
          projectId: detector.projectId,
          snubaQuery: detector.dataSources[0].queryObj.snubaQuery,
          statsPeriod: '24h',
        });

        expect(result?.buttonText).toBe('Open in Logs');
        expect(result?.to).toContain('/explore/logs/');
        expect(result?.to).toContain('statsPeriod=24h');
        expect(result?.to).toContain('project=1');
        expect(result?.to).toContain('environment=prod');
        expect(result?.to).toContain('logsAggregate=count');
        expect(result?.to).toContain('logsQuery=log.level%3Aerror');
      });
    });

    describe('Releases dataset', () => {
      it('returns null for releases/crash-free dataset', () => {
        const detector = MetricDetectorFixture({
          dataSources: [
            SnubaQueryDataSourceFixture({
              queryObj: {
                id: '1',
                status: 1,
                subscription: '1',
                snubaQuery: {
                  id: '1',
                  aggregate: 'crash_free_rate(session)',
                  dataset: Dataset.SESSIONS,
                  eventTypes: [],
                  query: '',
                  timeWindow: 3600,
                },
              },
            }),
          ],
        });

        const result = getDetectorOpenInDestination({
          detectorName: detector.name,
          organization,
          projectId: detector.projectId,
          snubaQuery: detector.dataSources[0].queryObj.snubaQuery,
          statsPeriod: '7d',
        });

        expect(result).toBeNull();
      });
    });

    describe('time period handling', () => {
      it('uses statsPeriod when provided', () => {
        const detector = MetricDetectorFixture({
          dataSources: [
            SnubaQueryDataSourceFixture({
              queryObj: {
                id: '1',
                status: 1,
                subscription: '1',
                snubaQuery: {
                  id: '1',
                  aggregate: 'count()',
                  dataset: Dataset.EVENTS_ANALYTICS_PLATFORM,
                  eventTypes: [],
                  query: '',
                  timeWindow: 300,
                },
              },
            }),
          ],
        });

        const result = getDetectorOpenInDestination({
          detectorName: detector.name,
          organization,
          projectId: detector.projectId,
          snubaQuery: detector.dataSources[0].queryObj.snubaQuery,
          statsPeriod: '14d',
        });

        expect(result?.to).toContain('statsPeriod=14d');
      });
    });
  });
});
