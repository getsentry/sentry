import type {TimeSeriesItem} from 'sentry/views/dashboards/widgets/common/types';

import {isLowConfidenceTimeSeriesItem} from './timeSeriesItemConfidence';

describe('isLowConfidenceTimeSeriesItem', () => {
  it.each([
    {confidence: 'low', sampleRate: 0.01, expected: true},
    {confidence: 'low', sampleRate: undefined, expected: true},
    {confidence: 'high', sampleRate: 0.01, expected: false},
    {confidence: null, sampleRate: 0.01, expected: true},
    {confidence: null, sampleRate: 1, expected: false},
    {confidence: null, sampleRate: null, expected: false},
    {confidence: undefined, sampleRate: 0.01, expected: false},
  ] as const)(
    'is $expected for $confidence confidence at sample rate $sampleRate',
    ({confidence, sampleRate, expected}) => {
      const item: TimeSeriesItem = {
        timestamp: 1,
        value: 1,
        confidence,
        sampleRate,
      };

      expect(isLowConfidenceTimeSeriesItem(item)).toBe(expected);
    }
  );
});
