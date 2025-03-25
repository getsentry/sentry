import {DurationUnit, RateUnit, SizeUnit} from 'sentry/utils/discover/fields';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';

import {scaleTimeSeriesData} from './scaleTimeSeriesData';

describe('scaleTimeSeriesData', () => {
  describe('does not scale unscalable types', () => {
    const timeSeries: TimeSeries = {
      field: 'user',
      data: [
        {
          timestamp: '2025-01-01T00:00:00',
          value: 17,
        },
      ],
      meta: {
        type: 'string',
        unit: null,
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
      field: 'transaction.duration',
      data: [
        {
          timestamp: '2025-01-01T00:00:00',
          value: 17,
        },
      ],
      meta: {
        type: 'duration',
        unit: DurationUnit.SECOND,
      },
    };

    expect(scaleTimeSeriesData(timeSeries, SizeUnit.GIGABYTE)).toEqual(timeSeries);
  });

  it('scales duration units from second to millisecond', () => {
    const timeSeries: TimeSeries = {
      field: 'transaction.duration',
      data: [
        {
          timestamp: '2025-01-01T00:00:00',
          value: 17,
        },
      ],
      meta: {
        type: 'duration',
        unit: DurationUnit.SECOND,
      },
    };

    expect(scaleTimeSeriesData(timeSeries, DurationUnit.MILLISECOND)).toEqual({
      field: 'transaction.duration',
      data: [
        {
          timestamp: '2025-01-01T00:00:00',
          value: 17000,
        },
      ],
      meta: {
        type: 'duration',
        unit: DurationUnit.MILLISECOND,
      },
    });
  });

  it('scales size units from mebibyte to byte', () => {
    const timeSeries: TimeSeries = {
      field: 'file.size',
      data: [
        {
          timestamp: '2025-01-01T00:00:00',
          value: 17,
        },
      ],
      meta: {
        type: 'size',
        unit: SizeUnit.MEBIBYTE,
      },
    };

    expect(scaleTimeSeriesData(timeSeries, SizeUnit.BYTE)).toEqual({
      field: 'file.size',
      data: [
        {
          timestamp: '2025-01-01T00:00:00',
          value: 17825792,
        },
      ],
      meta: {
        type: 'size',
        unit: SizeUnit.BYTE,
      },
    });
  });
});
