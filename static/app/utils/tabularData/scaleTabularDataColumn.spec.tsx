import type {TabularData} from 'sentry/views/dashboards/widgets/common/types';

import {DurationUnit, RateUnit, SizeUnit} from '../discover/fields';

import {scaleTabularDataColumn} from './scaleTabularDataColumn';

describe('scaleTabularDataColumn', () => {
  describe('does not scale unscalable types', () => {
    const tabularData: TabularData = {
      data: [
        {
          timestamp: '2025-01-01T00:00:00',
          'max(trace.id)': 'afbad',
        },
      ],
      meta: {
        fields: {
          'max(trace.id)': 'string',
        },
        units: {},
      },
    };

    it.each([RateUnit.PER_MINUTE, DurationUnit.SECOND, SizeUnit.GIBIBYTE, null] as const)(
      'Does not scale strings to %s',
      unit => {
        expect(scaleTabularDataColumn(tabularData, 'max(trace.id)', unit)).toEqual(
          tabularData
        );
      }
    );
  });

  it('does not scale duration units from second to gigabyte', () => {
    const tabularData: TabularData = {
      data: [
        {
          timestamp: '2025-01-01T00:00:00',
          'p99(span.duration)': 17,
        },
      ],
      meta: {
        fields: {
          'p99(span.duration)': 'duration',
        },
        units: {
          'p99(span.duration)': DurationUnit.SECOND,
        },
      },
    };

    expect(
      scaleTabularDataColumn(tabularData, 'p99(span.duration)', SizeUnit.GIGABYTE)
    ).toEqual(tabularData);
  });

  it('scales duration units from second to millisecond', () => {
    const tabularData: TabularData = {
      data: [
        {
          timestamp: '2025-01-01T00:00:00',
          'p99(span.duration)': 17,
        },
      ],
      meta: {
        fields: {
          'p99(span.duration)': 'duration',
        },
        units: {
          'p99(span.duration)': DurationUnit.SECOND,
        },
      },
    };

    expect(
      scaleTabularDataColumn(tabularData, 'p99(span.duration)', DurationUnit.MILLISECOND)
    ).toEqual({
      data: [
        {
          timestamp: '2025-01-01T00:00:00',
          'p99(span.duration)': 17000,
        },
      ],
      meta: {
        fields: {
          'p99(span.duration)': 'duration',
        },
        units: {
          'p99(span.duration)': DurationUnit.MILLISECOND,
        },
      },
    });
  });

  it('scales size units from mebibyte to byte', () => {
    const tabularData: TabularData = {
      data: [
        {
          timestamp: '2025-01-01T00:00:00',
          'p50(attachment.size)': 17,
        },
      ],
      meta: {
        fields: {
          'p50(attachment.size)': 'size',
        },
        units: {
          'p50(attachment.size)': SizeUnit.MEBIBYTE,
        },
      },
    };

    expect(
      scaleTabularDataColumn(tabularData, 'p50(attachment.size)', SizeUnit.BYTE)
    ).toEqual({
      data: [
        {
          timestamp: '2025-01-01T00:00:00',
          'p50(attachment.size)': 17825792,
        },
      ],
      meta: {
        fields: {
          'p50(attachment.size)': 'size',
        },
        units: {
          'p50(attachment.size)': SizeUnit.BYTE,
        },
      },
    });
  });
});
