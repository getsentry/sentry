import {DurationUnit, RateUnit, SizeUnit} from 'sentry/utils/discover/fields';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';

import {scaleTimeSeriesData} from './scaleTimeSeriesData';

describe('scaleTimeSeriesData', () => {
  describe('does not scale unscalable types', () => {
    const timeSeries: TimeSeries = {
      yAxis: 'user',
      values: [
        {
          timestamp: 1735707600000, // '2025-01-01T00:00:00'
          value: 17,
        },
      ],
      meta: {
        valueType: 'string',
        valueUnit: null,
        interval: 800,
      },
    };

    it.each([RateUnit.PER_MINUTE, DurationUnit.SECOND, SizeUnit.GIBIBYTE, null] as const)(
      'Does not scale strings to %s',
      unit => {
        expect(scaleTimeSeriesData(timeSeries, unit)).toEqual(timeSeries);
      }
    );
  });

  it('does not scale duration units from second to gigabyte', () => {
    const timeSeries: TimeSeries = {
      yAxis: 'transaction.duration',
      values: [
        {
          timestamp: 1735707600000, // '2025-01-01T00:00:00'
          value: 17,
        },
      ],
      meta: {
        valueType: 'duration',
        valueUnit: DurationUnit.SECOND,
        interval: 800,
      },
    };

    expect(scaleTimeSeriesData(timeSeries, SizeUnit.GIGABYTE)).toEqual(timeSeries);
  });

  it('scales duration units from second to millisecond', () => {
    const timeSeries: TimeSeries = {
      yAxis: 'transaction.duration',
      values: [
        {
          timestamp: 1735707600000, // '2025-01-01T00:00:00'
          value: 17,
        },
      ],
      meta: {
        valueType: 'duration',
        valueUnit: DurationUnit.SECOND,
        interval: 800,
      },
    };

    expect(scaleTimeSeriesData(timeSeries, DurationUnit.MILLISECOND)).toEqual({
      yAxis: 'transaction.duration',
      values: [
        {
          timestamp: 1735707600000, // '2025-01-01T00:00:00'
          value: 17000,
        },
      ],
      meta: {
        valueType: 'duration',
        valueUnit: DurationUnit.MILLISECOND,
        interval: 800,
      },
    });
  });

  it('scales size units from mebibyte to byte', () => {
    const timeSeries: TimeSeries = {
      yAxis: 'file.size',
      values: [
        {
          timestamp: 1735707600000, // '2025-01-01T00:00:00'
          value: 17,
        },
      ],
      meta: {
        valueType: 'size',
        valueUnit: SizeUnit.MEBIBYTE,
        interval: 800,
      },
    };

    expect(scaleTimeSeriesData(timeSeries, SizeUnit.BYTE)).toEqual({
      yAxis: 'file.size',
      values: [
        {
          timestamp: 1735707600000, // '2025-01-01T00:00:00'
          value: 17825792,
        },
      ],
      meta: {
        valueType: 'size',
        valueUnit: SizeUnit.BYTE,
        interval: 800,
      },
    });
  });
});
