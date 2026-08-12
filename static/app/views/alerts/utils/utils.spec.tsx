import {SessionsAggregate} from 'sentry/views/alerts/rules/metric/types';
import {
  alertAxisFormatter,
  alertTooltipValueFormatter,
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
});
