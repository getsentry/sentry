import {DataCategoryExact} from 'sentry/types/core';

import type {SpikeDetails} from 'getsentry/views/spikeProtection/types';
import {getSpikeDetailsFromSeries} from 'getsentry/views/spikeProtection/utils';

describe('getSpikeDetailsFromSeries', function () {
  function validateResults(
    actual: any,
    expectedStoredSpikes: Partial<SpikeDetails>[] = []
  ) {
    // required for the case where the actual is longer than the expected
    expect(actual).toHaveLength(expectedStoredSpikes.length);

    expectedStoredSpikes.forEach(res =>
      expect(actual).toContainEqual(expect.objectContaining(res))
    );
  }

  it('returns empty on error or no result', function () {
    expect(
      getSpikeDetailsFromSeries({
        dataCategory: DataCategoryExact.ERROR,
        storedSpikes: [],
      })
    ).toHaveLength(0);
  });

  it('returns valid results from stored spikes', function () {
    const storedSpikes = [
      {
        billingMetric: 1,
        endDate: new Date(2022, 0, 7, 0, 0, 0, 0).toISOString(),
        eventsDropped: 5,
        id: '1',
        initialThreshold: 1,
        organizationId: 1,
        projectId: 1,
        startDate: new Date(2022, 0, 6, 0, 0, 0, 0).toISOString(),
      },
      {
        billingMetric: 1,
        endDate: new Date(2022, 0, 7, 0, 45, 0, 0).toISOString(),
        eventsDropped: 4,
        id: '1',
        initialThreshold: 2,
        organizationId: 1,
        projectId: 1,
        startDate: new Date(2022, 0, 7, 0, 0, 0, 0).toISOString(),
      },
    ];
    const result = getSpikeDetailsFromSeries({
      dataCategory: DataCategoryExact.ERROR,
      storedSpikes,
    });
    const expectedStoredSpikes = [
      {
        start: storedSpikes[0]!.startDate,
        end: storedSpikes[0]!.endDate,
        dropped: 5,
        threshold: 1,
      },
      {
        start: storedSpikes[1]!.startDate,
        end: storedSpikes[1]!.endDate,
        dropped: 4,
        threshold: 2,
      },
    ];
    validateResults(result, expectedStoredSpikes);
  });

  it('returns stored spikes and overwrites calculated ones', function () {
    const storedSpikes = [
      {
        billingMetric: 1,
        endDate: new Date(2022, 0, 6, 0, 0, 0, 0).toISOString(),
        eventsDropped: 4,
        id: '1',
        initialThreshold: 2,
        organizationId: 1,
        projectId: 1,
        startDate: new Date(2022, 0, 3, 0, 45, 0, 0).toISOString(),
      },
      {
        billingMetric: 1,
        endDate: new Date(2022, 0, 8, 0, 15, 0, 0).toISOString(),
        eventsDropped: 4,
        id: '1',
        initialThreshold: 2,
        organizationId: 1,
        projectId: 1,
        startDate: new Date(2022, 0, 8, 0, 0, 0, 0).toISOString(),
      },
    ];
    const result = getSpikeDetailsFromSeries({
      dataCategory: DataCategoryExact.ERROR,
      storedSpikes,
    });
    const expectedStoredSpikes = [
      {
        start: storedSpikes[0]!.startDate,
        end: storedSpikes[0]!.endDate,
        dropped: 4,
        threshold: 2,
      },
      {
        start: storedSpikes[1]!.startDate,
        end: storedSpikes[1]!.endDate,
        dropped: 4,
        threshold: 2,
      },
    ];
    validateResults(result, expectedStoredSpikes);
  });
});
