import {
  getColdAppStartPerformance,
  getWarmAppStartPerformance,
  type MetricValue,
  PerformanceScore,
} from 'sentry/views/insights/mobile/screens/utils';
import {VitalState} from 'sentry/views/performance/vitalDetail/utils';

jest.mock('sentry/utils/usePageFilters');
jest.mock('sentry/utils/useLocation');

describe('Utils', function () {
  describe('Cold App Start', function () {
    it('renders bad', function () {
      const value: MetricValue = {unit: 'millisecond', value: 10000, type: 'duration'};
      const performance = getColdAppStartPerformance(value);
      expect(performance.score).toBe(PerformanceScore.BAD);
      expect(performance.description).toBe(VitalState.POOR);
    });
    it('renders meh', function () {
      const value: MetricValue = {unit: 'millisecond', value: 4000, type: 'duration'};
      const performance = getColdAppStartPerformance(value);
      expect(performance.score).toBe(PerformanceScore.NEEDS_IMPROVEMENT);
      expect(performance.description).toBe(VitalState.MEH);
    });
    it('renders good', function () {
      const value: MetricValue = {unit: 'millisecond', value: 1000, type: 'duration'};
      const performance = getColdAppStartPerformance(value);
      expect(performance.score).toBe(PerformanceScore.GOOD);
      expect(performance.description).toBe(VitalState.GOOD);
    });
    it('renders unknown', function () {
      const value: MetricValue = {unit: 'millisecond', value: 0, type: 'duration'};
      const performance = getColdAppStartPerformance(value);
      expect(performance.score).toBe(PerformanceScore.NONE);
      expect(performance.description).toBe('');
    });
  });

  describe('Warm App Start', function () {
    it('renders bad', function () {
      const value: MetricValue = {unit: 'millisecond', value: 3000, type: 'duration'};
      const performance = getWarmAppStartPerformance(value);
      expect(performance.score).toBe(PerformanceScore.BAD);
      expect(performance.description).toBe(VitalState.POOR);
    });
    it('renders meh', function () {
      const value: MetricValue = {unit: 'millisecond', value: 1500, type: 'duration'};
      const performance = getWarmAppStartPerformance(value);
      expect(performance.score).toBe(PerformanceScore.NEEDS_IMPROVEMENT);
      expect(performance.description).toBe(VitalState.MEH);
    });
    it('renders good', function () {
      const value: MetricValue = {unit: 'millisecond', value: 500, type: 'duration'};
      const performance = getWarmAppStartPerformance(value);
      expect(performance.score).toBe(PerformanceScore.GOOD);
      expect(performance.description).toBe(VitalState.GOOD);
    });
    it('renders unknown', function () {
      const value: MetricValue = {unit: 'millisecond', value: 0, type: 'duration'};
      const performance = getWarmAppStartPerformance(value);
      expect(performance.score).toBe(PerformanceScore.NONE);
      expect(performance.description).toBe('');
    });
  });
});
