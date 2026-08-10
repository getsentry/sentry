import {SessionsAggregate} from 'sentry/views/alerts/rules/metric/types';
import {
  alertAxisFormatter,
  alertTooltipValueFormatter,
  getTeamParams,
  isSessionAggregate,
} from 'sentry/views/alerts/utils';

describe('Alert utils', () => {
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
