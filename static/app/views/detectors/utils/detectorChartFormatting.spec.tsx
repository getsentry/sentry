import type {AggregationOutputType} from 'sentry/utils/discover/fields';

import {getDetectorChartFormatters} from './detectorChartFormatting';

describe('getDetectorChartFormatters', () => {
  it('static: count() returns number type and formats tooltip', () => {
    const result = getDetectorChartFormatters({
      detectionType: 'static',
      aggregate: 'count()',
    });

    expect(result.outputType).toBe('number');
    expect(result.unitSuffix).toBe('');
    expect(result.formatTooltipValue(1000)).toBe('1,000');
  });

  it('static: duration aggregate returns duration type and formats tooltip', () => {
    const result = getDetectorChartFormatters({
      detectionType: 'static',
      aggregate: 'avg(transaction.duration)',
    });

    expect(result.outputType).toBe('duration');
    expect(result.unitSuffix).toBe('ms');
    expect(result.formatTooltipValue(2000)).toBe('2.00s');
  });

  it('percent detection: uses aggregate output type and does not append % to formatters', () => {
    const result = getDetectorChartFormatters({
      detectionType: 'percent',
      aggregate: 'count()',
    });

    // % change detection should use the aggregate's actual type (number), not percentage
    expect(result.outputType).toBe('number');
    // unitSuffix is still % for threshold display purposes
    expect(result.unitSuffix).toBe('%');
    // But formatters should NOT append % since primary series shows actual metric values
    expect(result.formatTooltipValue(1000)).toBe('1,000');
    expect(result.formatYAxisLabel(1000)).toBe('1K');
  });

  it('percentage aggregate (crash_free_rate): returns percentage type', () => {
    const result = getDetectorChartFormatters({
      detectionType: 'static',
      aggregate: 'crash_free_rate(session)',
    });

    expect(result.outputType).toBe('percentage');
  });

  describe('server-provided unit and outputType', () => {
    it('prefers serverOutputType over client-inferred type', () => {
      // avg(number) would be inferred as 'number' by client
      const result = getDetectorChartFormatters({
        detectionType: 'static',
        aggregate: 'avg(value)',
        serverOutputType: 'duration',
        unit: 'day',
      });

      expect(result.outputType).toBe('duration');
    });

    it('formats duration tooltip and axis using the server-provided unit', () => {
      const result = getDetectorChartFormatters({
        detectionType: 'static',
        aggregate: 'avg(value)',
        serverOutputType: 'duration',
        unit: 'day',
      });

      expect(result.formatTooltipValue(5)).toBe('5.00d');
      expect(result.formatYAxisLabel(5)).toBe('5d');
    });

    it.each([
      ['duration', 'hour', 2, '2.00hr', '2hr'],
      ['duration', 'second', 30, '30.00s', '30s'],
      ['size', 'kibibyte', 5, '5.0 KiB', '5 KiB'],
      ['rate', '1/second', 100, '100/s', '100/s'],
    ])(
      'formats %s outputType with %s unit correctly',
      (outputType, unit, value, expectedTooltip, expectedYAxis): void => {
        const result = getDetectorChartFormatters({
          detectionType: 'static',
          aggregate: 'avg(value)',
          serverOutputType: outputType as AggregationOutputType,
          unit,
        });

        expect(result.formatTooltipValue(value)).toBe(expectedTooltip);
        expect(result.formatYAxisLabel(value)).toBe(expectedYAxis);
      }
    );

    it('falls back to client inference when no server type is provided', () => {
      // avg(transaction.duration) would be inferred as 'duration' by client
      const result = getDetectorChartFormatters({
        detectionType: 'static',
        aggregate: 'avg(transaction.duration)',
      });

      // Client infers 'duration' from the aggregate, defaults to ms
      expect(result.outputType).toBe('duration');
      expect(result.formatTooltipValue(500)).toBe('500.00ms');
    });
  });
});
