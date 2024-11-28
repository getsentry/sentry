import {resetMockDate, setMockDate} from 'sentry-test/utils';

import type {TimeseriesData} from '../common/types';

import {splitSeriesIntoCompleteAndIncomplete} from './splitSeriesIntoCompleteAndIncomplete';

describe('splitSeriesIntoCompleteAndIncomplete', () => {
  beforeEach(() => {
    setMockDate(new Date('2024-10-24T15:59:00.000Z'));
  });

  afterEach(() => {
    resetMockDate();
  });

  it('Does not split a series with all complete data', () => {
    const serie: TimeseriesData = {
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

    expect(incompleteSerie).toEqual(undefined);
  });

  it('Does not split a series with all incomplete data', () => {
    const serie: TimeseriesData = {
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
    };

    const [completeSerie, incompleteSerie] = splitSeriesIntoCompleteAndIncomplete(
      serie,
      90
    );

    expect(completeSerie).toEqual(undefined);

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
    const serie: TimeseriesData = {
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
    //
    const serie: TimeseriesData = {
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
