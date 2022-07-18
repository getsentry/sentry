import {LegendComponentOption} from 'echarts';

import {Series} from 'sentry/types/echarts';
import {
  axisLabelFormatter,
  categorizeDuration,
  findRangeOfMultiSeries,
  getDurationUnit,
  tooltipFormatter,
} from 'sentry/utils/discover/charts';
import {HOUR, MINUTE, SECOND} from 'sentry/utils/formatters';

describe('tooltipFormatter()', () => {
  it('formats values', () => {
    const cases: [string, number, string][] = [
      // function, input, expected
      ['count()', 0.1, '0.1'],
      ['avg(thing)', 0.125126, '0.125'],
      ['failure_rate()', 0.66123, '66.12%'],
      ['p50()', 100, '100.00ms'],
      ['p50()', 100.23, '100.23ms'],
      ['p50()', 1200, '1.20s'],
      ['p50()', 86400000, '1.00d'],
    ];
    for (const scenario of cases) {
      expect(tooltipFormatter(scenario[1], scenario[0])).toEqual(scenario[2]);
    }
  });
});

describe('axisLabelFormatter()', () => {
  it('formats values', () => {
    const cases: [string, number, string][] = [
      // type, input, expected
      ['count()', 0.1, '0.1'],
      ['avg(thing)', 0.125126, '0.125'],
      ['failure_rate()', 0.66123, '66%'],
      ['p50()', 100, '100ms'],
      ['p50()', 541, '541ms'],
      ['p50()', 1200, '1s'],
      ['p50()', 60000, '1min'],
      ['p50()', 120000, '2min'],
      ['p50()', 3600000, '1hr'],
      ['p50()', 86400000, '1d'],
    ];
    for (const scenario of cases) {
      expect(axisLabelFormatter(scenario[1], scenario[0])).toEqual(scenario[2]);
    }
  });

  describe('When a duration unit is passed', () => {
    const getAxisLabels = (axisValues: number[], durationUnit: number) => {
      return axisValues.map(value =>
        axisLabelFormatter(value, 'p50()', undefined, durationUnit)
      );
    };

    const generateDurationUnit = (axisValues: number[]) => {
      const max = Math.max(...axisValues);
      const min = Math.min(...axisValues);
      return categorizeDuration((max + min) * 0.5);
    };

    it('should not contain duplicate axis labels', () => {
      const axisValues = [40 * SECOND, 50 * SECOND, 60 * SECOND, 70 * SECOND];
      const durationUnit = generateDurationUnit(axisValues);
      const labels = getAxisLabels(axisValues, durationUnit);
      expect(labels.length).toBe(new Set(labels).size);
    });

    it('should use the same duration unit', () => {
      const axisValues = [50 * MINUTE, 150 * MINUTE, 250 * MINUTE, 350 * MINUTE];
      const durationUnit = generateDurationUnit(axisValues);
      const labels = getAxisLabels(axisValues, durationUnit);
      expect(labels.length).toBe(labels.filter(label => label.endsWith('hr')).length);
    });
  });
});

describe('findRangeOfMultiSeries()', () => {
  const series: Series[] = [
    {
      seriesName: 'p100()',
      data: [
        {name: 1, value: 2300},
        {name: 2, value: 1900},
        {name: 3, value: 1950},
      ],
    },
    {
      seriesName: 'p95()',
      data: [
        {name: 1, value: 300},
        {name: 2, value: 280},
        {name: 3, value: 290},
      ],
    },
    {
      seriesName: 'p50()',
      data: [
        {name: 1, value: 100},
        {name: 2, value: 50},
        {name: 3, value: 80},
      ],
    },
  ];

  it('should find min and max when no items selected in legend', () => {
    expect(findRangeOfMultiSeries(series)).toStrictEqual({max: 2300, min: 50});
  });

  it('should ignore p100 series if not selected', () => {
    const legend: LegendComponentOption = {
      selected: {'p100()': false},
    };
    expect(findRangeOfMultiSeries(series, legend)).toStrictEqual({max: 300, min: 50});
  });

  it('should ignore p50 series if not selected', () => {
    const legend: LegendComponentOption = {
      selected: {'p50()': false},
    };
    expect(findRangeOfMultiSeries(series, legend)).toStrictEqual({max: 2300, min: 280});
  });

  it('should display p100 value if selected and in legend object', () => {
    const legend: LegendComponentOption = {
      selected: {'p100()': true},
    };
    expect(findRangeOfMultiSeries(series, legend)).toStrictEqual({max: 2300, min: 50});
  });
});

describe('getDurationUnit()', () => {
  const generateSeries = (axisValues: number[]): Series[] => {
    return [
      {
        seriesName: 'p100()',
        data: axisValues.map((val, idx) => ({name: idx, value: val})),
      },
    ];
  };

  it('should return ms if y range is small', () => {
    const series = generateSeries([1000, 1050, 1100, 1150, 1200]);

    expect(getDurationUnit(series)).toBe(1);
  });

  it('should return min if yAxis range >= 5 min', () => {
    const series = generateSeries([1 * MINUTE, 2 * MINUTE, 4 * MINUTE, 6 * MINUTE]);

    expect(getDurationUnit(series)).toBe(MINUTE);
  });

  it('should return sec if yAxis range < 5 min', () => {
    const series = generateSeries([1 * MINUTE, 2 * MINUTE, 4 * MINUTE, 5 * MINUTE]);

    expect(getDurationUnit(series)).toBe(SECOND);
  });

  it('should use second with ms yAxis range if label length is long', () => {
    const series = generateSeries([4 * HOUR, 4.0001 * HOUR, 4.0002 * HOUR]);
    const durationUnit = getDurationUnit(series);
    const numOfDigits = ((4.0001 * HOUR) / durationUnit).toFixed(0).length;
    expect(numOfDigits).toBeLessThan(6);
    expect(durationUnit).not.toBe(1);
  });
});
