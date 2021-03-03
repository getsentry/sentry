import {initializeOrg} from 'sentry-test/initializeOrg';

import {getQueryDatasource} from 'app/views/alerts/utils';
import {getIncidentDiscoverUrl} from 'app/views/alerts/utils/getIncidentDiscoverUrl';
import {Dataset, Datasource} from 'app/views/settings/incidentRules/types';

describe('Alert utils', function () {
  const {org, projects} = initializeOrg();

  const mockStats = {
    eventStats: {
      data: [
        [0, 10],
        [120, 10],
      ],
    },
  };

  describe('getIncidentDiscoverUrl', function () {
    it('creates a discover query url for errors', function () {
      const incident = {
        title: 'Test error alert',
        discoverQuery: 'id:test',
        projects,
        alertRule: {
          timeWindow: 1,
          dataset: Dataset.ERRORS,
          aggregate: 'count()',
        },
      };

      const to = getIncidentDiscoverUrl({
        orgSlug: org.slug,
        projects,
        incident,
        stats: mockStats,
      });

      expect(to).toEqual({
        query: expect.objectContaining({
          name: 'Test error alert',
          field: ['issue', 'count()', 'count_unique(user)'],
          sort: ['-count'],
          query: 'id:test',
          yAxis: 'count()',
          start: '1970-01-01T00:00:00.000',
          end: '1970-01-01T00:02:00.000',
          interval: '1m',
        }),
        pathname: '/organizations/org-slug/discover/results/',
      });
    });

    it('creates a discover query url for transactions', function () {
      const incident = {
        title: 'Test transaction alert',
        discoverQuery: 'id:test',
        projects,
        alertRule: {
          timeWindow: 1,
          dataset: Dataset.TRANSACTIONS,
          aggregate: 'p90()',
        },
      };

      const to = getIncidentDiscoverUrl({
        orgSlug: org.slug,
        projects,
        incident,
        stats: mockStats,
      });

      expect(to).toEqual({
        query: expect.objectContaining({
          name: 'Test transaction alert',
          field: ['transaction', 'p90()'],
          sort: ['-p90'],
          query: 'id:test',
          yAxis: 'p90()',
        }),
        pathname: '/organizations/org-slug/discover/results/',
      });
    });
  });

  describe('getQuerySource', () => {
    it('should parse event type error or default', () => {
      expect(getQueryDatasource('event.type:default OR event.type:error')).toEqual({
        source: Datasource.ERROR_DEFAULT,
        query: '',
      });
      expect(
        getQueryDatasource(
          'event.type:error OR event.type:default transaction.duration:<30s'
        )
      ).toEqual({
        source: Datasource.ERROR_DEFAULT,
        query: 'transaction.duration:<30s',
      });
      expect(
        getQueryDatasource('event.type:error OR (event.type:default event.level:fatal)')
      ).toEqual({
        source: Datasource.ERROR_DEFAULT,
        query: 'event.level:fatal)',
      });
      expect(
        getQueryDatasource('(event.type:error OR event.type:default) event.level:fatal')
      ).toEqual({
        source: Datasource.ERROR_DEFAULT,
        query: 'event.level:fatal',
      });
    });

    it('should not allow event type transaction with anything else', () => {
      expect(getQueryDatasource('event.type:error OR event.type:transaction')).toBeNull();
      expect(
        getQueryDatasource('event.type:transaction OR event.type:default')
      ).toBeNull();
    });

    it('should not allow boolean event types', () => {
      expect(getQueryDatasource('!event.type:error')).toBeNull();
      expect(getQueryDatasource('!event.type:transaction something')).toBeNull();
      expect(getQueryDatasource('!event.type:default')).toBeNull();
    });

    it('should allow error, transaction, default alone', () => {
      expect(getQueryDatasource('event.type:error test')).toEqual({
        source: Datasource.ERROR,
        query: 'test',
      });
      expect(getQueryDatasource('event.type:default test')).toEqual({
        source: Datasource.DEFAULT,
        query: 'test',
      });
      expect(getQueryDatasource('event.type:transaction test')).toEqual({
        source: Datasource.TRANSACTION,
        query: 'test',
      });
      expect(
        getQueryDatasource(
          'event.type:error explode OR (event.type:default event.level:fatal)'
        )
      ).toEqual({
        source: Datasource.ERROR,
        query: 'explode OR (event.type:default event.level:fatal)',
      });
    });
  });
});
