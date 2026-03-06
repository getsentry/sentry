import type {LegendComponentOption} from 'echarts';

import type {Series} from 'sentry/types/echarts';
import {
  axisLabelFormatter,
  axisLabelFormatterUsingAggregateOutputType,
  findRangeOfMultiSeries,
  getDurationUnit,
  tooltipFormatter,
  tooltipFormatterUsingAggregateOutputType,
} from 'sentry/utils/discover/charts';
import {aggregateOutputType, DurationUnit, SizeUnit} from 'sentry/utils/discover/fields';
import {HOUR, MINUTE, SECOND} from 'sentry/utils/formatters';

import {categorizeDuration} from './categorizeDuration';

describe('tooltipFormatter()', () => {
  it('formats values', () => {
    const cases: Array<[string, number, string]> = [
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
      expect(tooltipFormatter(scenario[1], aggregateOutputType(scenario[0]))).toEqual(
        scenario[2]
      );
    }
  });
});

describe('tooltipFormatterUsingAggregateOutputType()', () => {
  it('formats values', () => {
    const cases: Array<[string, number, string]> = [
      // function, input, expected
      ['number', 0.1, '0.1'],
      ['integer', 0.125, '0.125'],
      ['percentage', 0.6612, '66.12%'],
      ['duration', 321, '321.00ms'],
      ['size', 416 * 1024, '416.0 KiB'],
      ['', 444, '444'],
    ];
    for (const scenario of cases) {
      expect(tooltipFormatterUsingAggregateOutputType(scenario[1], scenario[0])).toEqual(
        scenario[2]
      );
    }
  });

  it('formats size with base 10 when unit is a decimal byte unit', () => {
    expect(
      tooltipFormatterUsingAggregateOutputType(50 * 1000 * 1000, 'size', SizeUnit.BYTE)
    ).toBe('50 MB');
    expect(tooltipFormatterUsingAggregateOutputType(1000, 'size', SizeUnit.BYTE)).toBe(
      '1 KB'
    );
  });

  it('converts duration values from the provided unit to display correctly', () => {
    // 5 days reported as value=5 with unit=day should display as "5.00d"
    expect(
      tooltipFormatterUsingAggregateOutputType(5, 'duration', DurationUnit.DAY)
    ).toBe('5.00d');

    // 2 hours reported as value=2 with unit=hour should display as "2.00hr"
    expect(
      tooltipFormatterUsingAggregateOutputType(2, 'duration', DurationUnit.HOUR)
    ).toBe('2.00hr');

    // 30 seconds reported as value=30 with unit=second should display as "30.00s"
    expect(
      tooltipFormatterUsingAggregateOutputType(30, 'duration', DurationUnit.SECOND)
    ).toBe('30.00s');

    // 500 milliseconds reported as value=500 with unit=millisecond (default) should display as "500.00ms"
    expect(
      tooltipFormatterUsingAggregateOutputType(500, 'duration', DurationUnit.MILLISECOND)
    ).toBe('500.00ms');
  });

  it('defaults to milliseconds when no duration unit is provided', () => {
    // Without a unit, 500 should be treated as 500ms
    expect(tooltipFormatterUsingAggregateOutputType(500, 'duration')).toBe('500.00ms');
    // 86400000ms = 1 day
    expect(tooltipFormatterUsingAggregateOutputType(86400000, 'duration')).toBe('1.00d');
  });

  it('converts size values from the provided unit', () => {
    // 5 kibibytes reported as value=5 with unit=kibibyte
    expect(tooltipFormatterUsingAggregateOutputType(5, 'size', SizeUnit.KIBIBYTE)).toBe(
      '5.0 KiB'
    );

    // 2 megabytes reported as value=2 with unit=megabyte (base 10)
    expect(tooltipFormatterUsingAggregateOutputType(2, 'size', SizeUnit.MEGABYTE)).toBe(
      '2 MB'
    );
  });
});

describe('axisLabelFormatter()', () => {
  it('formats values', () => {
    const cases: Array<[string, number, string]> = [
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
      expect(axisLabelFormatter(scenario[1], aggregateOutputType(scenario[0]))).toEqual(
        scenario[2]
      );
    }
  });

  describe('When a duration unit is passed', () => {
    const getAxisLabels = (axisValues: number[], durationUnit: number) => {
      return axisValues.map(value =>
        axisLabelFormatter(value, 'duration', undefined, durationUnit)
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
      expect(labels).toHaveLength(new Set(labels).size);
    });

    it('should use the same duration unit', () => {
      const axisValues = [50 * MINUTE, 150 * MINUTE, 250 * MINUTE, 350 * MINUTE];
      const durationUnit = generateDurationUnit(axisValues);
      const labels = getAxisLabels(axisValues, durationUnit);
      expect(labels).toHaveLength(labels.filter(label => label.endsWith('hr')).length);
    });
  });
});

describe('axisLabelFormatterUsingAggregateOutputType()', () => {
  it('formats values', () => {
    const cases: Array<[string, number, string]> = [
      // type, input, expected
      ['number', 0.1, '0.1'],
      ['integer', 0.125, '0.125'],
      ['percentage', 0.6612, '66%'],
      ['duration', 321, '321ms'],
      ['size', 416 * 1024, '416 KiB'],
      ['', 444, '444'],
    ];
    for (const scenario of cases) {
      expect(
        axisLabelFormatterUsingAggregateOutputType(scenario[1], scenario[0])
      ).toEqual(scenario[2]);
    }
  });

  it('formats size with base 10 when unit is a decimal byte unit', () => {
    expect(
      axisLabelFormatterUsingAggregateOutputType(
        50 * 1000 * 1000,
        'size',
        false,
        undefined,
        undefined,
        0,
        SizeUnit.BYTE
      )
    ).toBe('50 MB');
    expect(
      axisLabelFormatterUsingAggregateOutputType(
        1000,
        'size',
        false,
        undefined,
        undefined,
        0,
        SizeUnit.BYTE
      )
    ).toBe('1 KB');
  });

  it('converts duration values using the data unit passed via sizeUnit', () => {
    // value=5 with unit=day → 5 * 86400000ms = 432000000ms → "5d"
    expect(
      axisLabelFormatterUsingAggregateOutputType(
        5,
        'duration',
        true,
        undefined,
        undefined,
        0,
        DurationUnit.DAY
      )
    ).toBe('5d');

    // value=2 with unit=hour → 2 * 3600000ms = 7200000ms → "2hr"
    expect(
      axisLabelFormatterUsingAggregateOutputType(
        2,
        'duration',
        true,
        undefined,
        undefined,
        0,
        DurationUnit.HOUR
      )
    ).toBe('2hr');

    // value=90 with unit=second → 90 * 1000ms = 90000ms → "2min" (auto-categorized)
    expect(
      axisLabelFormatterUsingAggregateOutputType(
        90,
        'duration',
        true,
        undefined,
        undefined,
        0,
        DurationUnit.SECOND
      )
    ).toBe('2min');
  });

  it('converts size values using the data unit passed via sizeUnit', () => {
    // value=5 with unit=kibibyte → 5 * 1024 = 5120 bytes → "5 KiB"
    expect(
      axisLabelFormatterUsingAggregateOutputType(
        5,
        'size',
        false,
        undefined,
        undefined,
        0,
        SizeUnit.KIBIBYTE
      )
    ).toBe('5 KiB');
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

  it('should find min and max when series is unordered', () => {
    const mixedSeries = [series[1]!, series[0]!, series[2]!];
    expect(findRangeOfMultiSeries(mixedSeries)).toStrictEqual({max: 2300, min: 50});
  });

  it('should find min and max when one of the series has all 0 values', () => {
    const mixedSeries = [
      {
        seriesName: 'p75(spans.db)',
        data: [
          {name: 1, value: 0},
          {name: 2, value: 0},
          {name: 3, value: 0},
        ],
      },
      series[1]!,
      series[0]!,
      series[2]!,
    ];
    expect(findRangeOfMultiSeries(mixedSeries)).toStrictEqual({max: 2300, min: 0});
  });

  it('should find min and max when one of the series has negative values', () => {
    const mixedSeries = [
      {
        seriesName: 'p75(custom.measurement)',
        data: [
          {name: 1, value: 10},
          {name: 2, value: -10},
          {name: 3, value: 10},
        ],
      },
      series[1]!,
      series[0]!,
      series[2]!,
    ];
    expect(findRangeOfMultiSeries(mixedSeries)).toStrictEqual({max: 2300, min: -10});
  });

  it('should find min and max when series has no data', () => {
    const noDataSeries: Series[] = [
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
        data: [],
      },
      {
        seriesName: 'p50()',
        data: [],
      },
    ];
    expect(findRangeOfMultiSeries(noDataSeries)).toStrictEqual({max: 2300, min: 1900});
  });

  it('should not find range if no items selected', () => {
    const legend: LegendComponentOption = {
      selected: {'p100()': false, 'p95()': false, 'p50()': false},
    };
    expect(findRangeOfMultiSeries(series, legend)).toBeUndefined();
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
  const MILLISECOND = 1;
  const generateSeries = (axisValues: number[]): Series[] => {
    return [
      {
        seriesName: 'p100()',
        data: axisValues.map((val, idx) => ({name: idx, value: val})),
      },
    ];
  };

  it('should return ms during transtion between ms to s', () => {
    const series = generateSeries([700, 800, 900, SECOND, 1.1 * SECOND]);

    expect(getDurationUnit(series)).toBe(MILLISECOND);
  });

  it('should return s during transtion between s to min', () => {
    const series = generateSeries([40 * SECOND, 50 * SECOND, MINUTE, 1.3 * MINUTE]);

    expect(getDurationUnit(series)).toBe(SECOND);
  });

  it('should return ms if y range is small', () => {
    const series = generateSeries([1000, 1050, 1100, 1150, 1200]);

    expect(getDurationUnit(series)).toBe(MILLISECOND);
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
    expect(durationUnit).not.toBe(MILLISECOND);
  });

  it('Should return ms if all values are 0', () => {
    const series = generateSeries([0, 0, 0]);
    const durationUnit = getDurationUnit(series);
    expect(durationUnit).toBe(MILLISECOND);
  });

  it('should convert values using dataUnit before categorizing', () => {
    // Values [1, 2, 3, 4, 5] in days → range = 4 days = 345600000ms
    // /5 = 69120000ms (~19.2hr) → categorizes tick interval as HOUR
    const series = generateSeries([1, 2, 3, 4, 5]);
    expect(getDurationUnit(series, undefined, DurationUnit.DAY)).toBe(HOUR);
    // Without the unit, same values [1..5] are treated as ms → MILLISECOND
    expect(getDurationUnit(series)).toBe(MILLISECOND);
  });

  it('should categorize correctly for hour-scale data with dataUnit', () => {
    // Values [1, 2, 3, 4] in hours → range = 3hr = 10800000ms
    // /5 = 2160000ms (~36min) → categorizes tick interval as MINUTE
    const series = generateSeries([1, 2, 3, 4]);
    expect(getDurationUnit(series, undefined, DurationUnit.HOUR)).toBe(MINUTE);
    // Without the unit, same values [1..4] are treated as ms → MILLISECOND
    expect(getDurationUnit(series)).toBe(MILLISECOND);
  });
});
