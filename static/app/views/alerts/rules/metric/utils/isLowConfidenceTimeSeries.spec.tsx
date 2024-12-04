import type {EventsStats, MultiSeriesEventsStats} from 'sentry/types/organization';
import {isLowConfidenceTimeSeries} from 'sentry/views/alerts/rules/metric/utils/isLowConfidenceTimeSeries';

describe('isLowConfidenceTimeSeries', () => {
  describe('EventsStats', () => {
    it('should return false when no data points have low confidence', () => {
      const eventsStats: EventsStats = {
        data: [
          [1731556800, [{count: 100}]],
          [1731560400, [{count: 200}]],
        ],
        confidence: [
          [1731556800, [{count: 'high'}]],
          [1731560400, [{count: 'high'}]],
        ],
      };
      expect(isLowConfidenceTimeSeries(eventsStats)).toBe(false);
    });
    it('should return true when any data points have low confidence', () => {
      const eventsStats: EventsStats = {
        data: [
          [1731556800, [{count: 100}]],
          [1731560400, [{count: 200}]],
        ],
        confidence: [
          [1731556800, [{count: 'low'}]],
          [1731560400, [{count: 'high'}]],
        ],
      };
      expect(isLowConfidenceTimeSeries(eventsStats)).toBe(true);
    });
  });

  describe('MultiSeriesEventsStats', () => {
    it('should return false when no data points have low confidence', () => {
      const multiSeriesEventsStats: MultiSeriesEventsStats = {
        a: {
          data: [
            [1731556800, [{count: 100}]],
            [1731560400, [{count: 200}]],
          ],
          confidence: [
            [1731556800, [{count: 'high'}]],
            [1731560400, [{count: 'high'}]],
          ],
        },
        b: {
          data: [
            [1731556800, [{count: 100}]],
            [1731560400, [{count: 200}]],
          ],
          confidence: [
            [1731556800, [{count: 'high'}]],
            [1731560400, [{count: 'high'}]],
          ],
        },
      };
      expect(isLowConfidenceTimeSeries(multiSeriesEventsStats)).toBe(false);
    });
    it('should return true when any data points have low confidence', () => {
      const multiSeriesEventsStats: MultiSeriesEventsStats = {
        a: {
          data: [
            [1731556800, [{count: 100}]],
            [1731560400, [{count: 200}]],
          ],
          confidence: [
            [1731556800, [{count: 'low'}]],
            [1731560400, [{count: 'high'}]],
          ],
        },
        b: {
          data: [
            [1731556800, [{count: 100}]],
            [1731560400, [{count: 200}]],
          ],
          confidence: [
            [1731556800, [{count: 'high'}]],
            [1731560400, [{count: 'high'}]],
          ],
        },
      };
      expect(isLowConfidenceTimeSeries(multiSeriesEventsStats)).toBe(true);
    });
  });
});
