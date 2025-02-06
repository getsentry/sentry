import {resetMockDate, setMockDate} from 'sentry-test/utils';

import {splitSeriesIntoCompleteAndIncomplete} from './splitSeriesIntoCompleteAndIncomplete';

describe('splitSeriesIntoCompleteAndIncomplete', () => {
  beforeEach(() => {
    setMockDate(new Date('2024-10-24T15:59:00.000Z'));
  });

  afterEach(() => {
    resetMockDate();
  });

  it('Does not split a series with all complete data', () => {
    const serie = {
      field: 'p99(span.duration)',
      data: [
        {
          value: 90,
          timestamp: '2024-10-24T15:54:00.000Z',
        },
        {
          value: 100,
          timestamp: '2024-10-24T15:55:00.000Z',
        },
        {
          value: 110,
          timestamp: '2024-10-24T15:56:00.000Z',
        },
      ],
      meta: {
        fields: {
          'p99(span.duration)': 'duration',
        },
        units: {
          'p99(span.duration)': 'millisecond',
        },
      },
    };

    const [completeSerie, incompleteSerie] = splitSeriesIntoCompleteAndIncomplete(
      serie,
      90
    );

    expect(completeSerie?.data).toEqual([
      {
        value: 90,
        timestamp: '2024-10-24T15:54:00.000Z',
      },
      {
        value: 100,
        timestamp: '2024-10-24T15:55:00.000Z',
      },
      {
        value: 110,
        timestamp: '2024-10-24T15:56:00.000Z',
      },
    ]);

    expect(incompleteSerie).toBeUndefined();
  });

  it('Does not split a series with all incomplete data', () => {
    const serie = {
      field: 'p99(span.duration)',
      data: [
        {
          value: 90,
          timestamp: '2024-10-24T15:58:05.000Z',
        },
        {
          value: 100,
          timestamp: '2024-10-24T15:58:10.000Z',
        },
        {
          value: 110,
          timestamp: '2024-10-24T15:58:15.000Z',
        },
        {
          value: 120,
          timestamp: '2024-10-24T15:58:20.000Z',
        },
      ],
      meta: {
        fields: {
          'p99(span.duration)': 'duration',
        },
        units: {
          'p99(span.duration)': 'millisecond',
        },
      },
    };

    const [completeSerie, incompleteSerie] = splitSeriesIntoCompleteAndIncomplete(
      serie,
      90
    );

    expect(completeSerie).toBeUndefined();

    expect(incompleteSerie?.data).toEqual([
      {
        value: 90,
        timestamp: '2024-10-24T15:58:05.000Z',
      },
      {
        value: 100,
        timestamp: '2024-10-24T15:58:10.000Z',
      },
      {
        value: 110,
        timestamp: '2024-10-24T15:58:15.000Z',
      },
      {
        value: 120,
        timestamp: '2024-10-24T15:58:20.000Z',
      },
    ]);
  });

  it('Splits a series with partial incomplete data', () => {
    const serie = {
      field: 'p99(span.duration)',
      data: [
        {
          value: 100,
          timestamp: '2024-10-24T15:55:00.000Z',
        },
        {
          value: 110,
          timestamp: '2024-10-24T15:56:00.000Z',
        },
        {
          value: 120,
          timestamp: '2024-10-24T15:57:00.000Z',
        },
        {
          value: 130,
          timestamp: '2024-10-24T15:58:00.000Z',
        },
        {
          value: 140,
          timestamp: '2024-10-24T15:59:00.000Z',
        },
      ],
      meta: {
        fields: {
          'p99(span.duration)': 'duration',
        },
        units: {
          'p99(span.duration)': 'millisecond',
        },
      },
    };

    const [completeSerie, incompleteSerie] = splitSeriesIntoCompleteAndIncomplete(
      serie,
      90
    );

    expect(completeSerie?.data).toEqual([
      {
        value: 100,
        timestamp: '2024-10-24T15:55:00.000Z',
      },
      {
        value: 110,
        timestamp: '2024-10-24T15:56:00.000Z',
      },
    ]);

    expect(incompleteSerie?.data).toEqual([
      {
        value: 110,
        timestamp: '2024-10-24T15:56:00.000Z',
      },
      {
        value: 120,
        timestamp: '2024-10-24T15:57:00.000Z',
      },
      {
        value: 130,
        timestamp: '2024-10-24T15:58:00.000Z',
      },
      {
        value: 140,
        timestamp: '2024-10-24T15:59:00.000Z',
      },
    ]);
  });

  it('Splits a series with long buckets', () => {
    // The time buckets are an hour long. The ingestion delay is 90s. The last buckets should be marked incomplete.

    const serie = {
      field: 'p99(span.duration)',
      data: [
        {
          value: 110,
          timestamp: '2024-10-24T12:00:00.000Z',
        },
        {
          value: 120,
          timestamp: '2024-10-24T13:00:00.000Z',
        },
        {
          value: 130,
          timestamp: '2024-10-24T14:00:00.000Z',
        },
        {
          value: 140,
          timestamp: '2024-10-24T15:00:00.000Z',
        },
      ],
      meta: {
        fields: {
          'p99(span.duration)': 'duration',
        },
        units: {
          'p99(span.duration)': 'millisecond',
        },
      },
    };

    const [completeSerie, incompleteSerie] = splitSeriesIntoCompleteAndIncomplete(
      serie,
      90
    );

    expect(completeSerie?.data).toEqual([
      {
        value: 110,
        timestamp: '2024-10-24T12:00:00.000Z',
      },
      {
        value: 120,
        timestamp: '2024-10-24T13:00:00.000Z',
      },
      {
        value: 130,
        timestamp: '2024-10-24T14:00:00.000Z',
      },
    ]);

    expect(incompleteSerie?.data).toEqual([
      {
        value: 130,
        timestamp: '2024-10-24T14:00:00.000Z',
      },
      {
        value: 140,
        timestamp: '2024-10-24T15:00:00.000Z',
      },
    ]);
  });
});
