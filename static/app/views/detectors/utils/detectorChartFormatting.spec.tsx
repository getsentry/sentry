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

  it('percent detection: returns percentage type and % suffix', () => {
    const result = getDetectorChartFormatters({
      detectionType: 'percent',
      aggregate: 'count()',
    });

    expect(result.outputType).toBe('percentage');
    expect(result.unitSuffix).toBe('%');
    expect(result.formatTooltipValue(0.25)).toBe('25%');
  });
});
