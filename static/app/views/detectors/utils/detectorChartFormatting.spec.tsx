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
    expect(result.formatYAxisLabel(1000)).toBe('1k');
  });

  it('percentage aggregate (crash_free_rate): returns percentage type', () => {
    const result = getDetectorChartFormatters({
      detectionType: 'static',
      aggregate: 'crash_free_rate(session)',
    });

    expect(result.outputType).toBe('percentage');
  });
});
