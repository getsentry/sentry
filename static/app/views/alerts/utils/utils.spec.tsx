import {IncidentFixture} from 'sentry-fixture/incident';
import {MetricRuleFixture} from 'sentry-fixture/metricRule';

import {initializeOrg} from 'sentry-test/initializeOrg';

import {
  Dataset,
  Datasource,
  SessionsAggregate,
} from 'sentry/views/alerts/rules/metric/types';
import type {IncidentStats} from 'sentry/views/alerts/types';
import {
  alertAxisFormatter,
  alertTooltipValueFormatter,
  getQueryDatasource,
  getTeamParams,
  isSessionAggregate,
} from 'sentry/views/alerts/utils';
import {getIncidentDiscoverUrl} from 'sentry/views/alerts/utils/getIncidentDiscoverUrl';

describe('Alert utils', function () {
  const {organization, projects} = initializeOrg();

  const mockStats: IncidentStats = {
    eventStats: {
      data: [
        [0, [{count: 10}]],
        [120, [{count: 10}]],
      ],
    },
    totalEvents: 0,
    uniqueUsers: 0,
  };

  describe('getIncidentDiscoverUrl', function () {
    it('creates a discover query url for errors', function () {
      const incident = IncidentFixture({
        title: 'Test error alert',
        discoverQuery: 'id:test',
        projects: projects.map(project => project.id),
        alertRule: MetricRuleFixture({
          timeWindow: 1,
          dataset: Dataset.ERRORS,
          aggregate: 'count()',
        }),
      });

      const to = getIncidentDiscoverUrl({
        organization,
        projects,
        incident,
        stats: mockStats,
      });

      expect(to).toEqual({
        query: expect.objectContaining({
          name: 'Test error alert',
          field: ['issue', 'count()', 'count_unique(user)'],
          sort: '-count',
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
      const incident = IncidentFixture({
        title: 'Test transaction alert',
        discoverQuery: 'id:test',
        projects: projects.map(project => project.id),
        alertRule: MetricRuleFixture({
          timeWindow: 1,
          dataset: Dataset.TRANSACTIONS,
          aggregate: 'p90()',
        }),
      });

      const to = getIncidentDiscoverUrl({
        organization,
        projects,
        incident,
        stats: mockStats,
      });

      expect(to).toEqual({
        query: expect.objectContaining({
          name: 'Test transaction alert',
          field: ['transaction', 'p90()'],
          sort: '-p90',
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

  describe('isSessionAggregate', () => {
    it('accepts session aggregate', () => {
      Object.values(SessionsAggregate).forEach(aggregate => {
        expect(isSessionAggregate(aggregate)).toBeTruthy();
      });
    });

    it('rejects other aggregates', () => {
      expect(isSessionAggregate('p95(transaction.duration)')).toBeFalsy();
    });
  });

  describe('alertAxisFormatter', () => {
    it('formatts', () => {
      expect(
        alertAxisFormatter(
          98.312,
          'Crash Free Rate',
          SessionsAggregate.CRASH_FREE_SESSIONS
        )
      ).toBe('98.31%');
      expect(alertAxisFormatter(0.1234, 'failure_rate()', 'failure_rate()')).toBe('12%');
    });
  });

  describe('alertTooltipValueFormatter', () => {
    it('formatts', () => {
      expect(
        alertTooltipValueFormatter(
          98.312,
          'Crash Free Rate',
          SessionsAggregate.CRASH_FREE_SESSIONS
        )
      ).toBe('98.312%');
      expect(alertTooltipValueFormatter(0.1234, 'failure_rate()', 'failure_rate()')).toBe(
        '12.34%'
      );
    });
  });

  describe('getTeamParams', () => {
    it('should use default teams', () => {
      expect(getTeamParams()).toEqual(['myteams', 'unassigned']);
    });
    it('should allow no teams with an empty string param', () => {
      expect(getTeamParams('')).toEqual([]);
    });
    it('should allow one or more teams', () => {
      expect(getTeamParams('team-sentry')).toEqual(['team-sentry']);
      expect(getTeamParams(['team-sentry', 'team-two'])).toEqual([
        'team-sentry',
        'team-two',
      ]);
    });
  });
});
