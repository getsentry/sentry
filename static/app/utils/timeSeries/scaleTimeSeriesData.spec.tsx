import {DurationUnit, RateUnit, SizeUnit} from 'sentry/utils/discover/fields';

import {scaleTimeSeriesData} from './scaleTimeSeriesData';

describe('scaleTimeSeriesData', () => {
  describe('does not scale unscalable types', () => {
    const timeSeries = {
      field: 'user',
      data: [
        {
          timestamp: '2025-01-01T00:00:00',
          value: 17,
        },
      ],
      meta: {
        fields: {
          user: 'string',
        },
        units: {
          user: null,
        },
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
    const timeSeries = {
      field: 'transaction.duration',
      data: [
        {
          timestamp: '2025-01-01T00:00:00',
          value: 17,
        },
      ],
      meta: {
        fields: {
          'transaction.duration': 'duration',
        },
        units: {
          'transaction.duration': 'second',
        },
      },
    };

    expect(scaleTimeSeriesData(timeSeries, SizeUnit.GIGABYTE)).toEqual(timeSeries);
  });

  it('scales duration units from second to millisecond', () => {
    const timeSeries = {
      field: 'transaction.duration',
      data: [
        {
          timestamp: '2025-01-01T00:00:00',
          value: 17,
        },
      ],
      meta: {
        fields: {
          'transaction.duration': 'duration',
        },
        units: {
          'transaction.duration': 'second',
        },
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
        fields: {
          'transaction.duration': 'duration',
        },
        units: {
          'transaction.duration': 'millisecond',
        },
      },
    });
  });

  it('scales size units from mebibyte to byte', () => {
    const timeSeries = {
      field: 'file.size',
      data: [
        {
          timestamp: '2025-01-01T00:00:00',
          value: 17,
        },
      ],
      meta: {
        fields: {
          'file.size': 'size',
        },
        units: {
          'file.size': 'mebibyte',
        },
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
        fields: {
          'file.size': 'size',
        },
        units: {
          'file.size': 'byte',
        },
      },
    });
  });
});
