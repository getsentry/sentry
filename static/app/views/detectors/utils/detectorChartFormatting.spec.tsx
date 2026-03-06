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

    it('formats duration tooltip using the server-provided unit', () => {
      const result = getDetectorChartFormatters({
        detectionType: 'static',
        aggregate: 'avg(value)',
        serverOutputType: 'duration',
        unit: 'day',
      });

      // value=5 with unit=day should display as "5.00d", not "5.00ms"
      expect(result.formatTooltipValue(5)).toBe('5.00d');
    });

    it('formats duration axis label using the server-provided unit', () => {
      const result = getDetectorChartFormatters({
        detectionType: 'static',
        aggregate: 'avg(value)',
        serverOutputType: 'duration',
        unit: 'day',
      });

      // value=5 with unit=day should display as "5d" on axis
      expect(result.formatYAxisLabel(5)).toBe('5d');
    });

    it('formats duration in hours correctly', () => {
      const result = getDetectorChartFormatters({
        detectionType: 'static',
        aggregate: 'avg(value)',
        serverOutputType: 'duration',
        unit: 'hour',
      });

      expect(result.formatTooltipValue(2)).toBe('2.00hr');
      expect(result.formatYAxisLabel(2)).toBe('2hr');
    });

    it('formats duration in seconds correctly', () => {
      const result = getDetectorChartFormatters({
        detectionType: 'static',
        aggregate: 'avg(value)',
        serverOutputType: 'duration',
        unit: 'second',
      });

      expect(result.formatTooltipValue(30)).toBe('30.00s');
      expect(result.formatYAxisLabel(30)).toBe('30s');
    });

    it('formats size tooltip using the server-provided unit', () => {
      const result = getDetectorChartFormatters({
        detectionType: 'static',
        aggregate: 'avg(number)',
        serverOutputType: 'size',
        unit: 'kibibyte',
      });

      // value=5 with unit=kibibyte → 5 KiB
      expect(result.formatTooltipValue(5)).toBe('5.0 KiB');
    });

    it('formats size axis label using the server-provided unit', () => {
      const result = getDetectorChartFormatters({
        detectionType: 'static',
        aggregate: 'avg(value)',
        serverOutputType: 'size',
        unit: 'kibibyte',
      });

      expect(result.formatYAxisLabel(5)).toBe('5 KiB');
    });

    it('formats rate using the server-provided unit', () => {
      const result = getDetectorChartFormatters({
        detectionType: 'static',
        aggregate: 'avg(value)',
        serverOutputType: 'rate',
        unit: '1/second',
      });

      expect(result.formatTooltipValue(100)).toBe('100/s');
      expect(result.formatYAxisLabel(100)).toBe('100/s');
    });

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
