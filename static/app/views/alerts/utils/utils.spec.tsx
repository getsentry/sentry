import {Datasource, SessionsAggregate} from 'sentry/views/alerts/rules/metric/types';
import {
  alertAxisFormatter,
  alertTooltipValueFormatter,
  getQueryDatasource,
  getTeamParams,
  isSessionAggregate,
} from 'sentry/views/alerts/utils';

describe('Alert utils', () => {
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
