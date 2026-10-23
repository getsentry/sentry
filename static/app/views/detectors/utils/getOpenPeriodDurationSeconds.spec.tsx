import {GroupOpenPeriodFixture} from 'sentry-fixture/groupOpenPeriod';

import {getOpenPeriodDurationSeconds} from 'sentry/views/detectors/utils/getOpenPeriodDurationSeconds';

describe('getOpenPeriodDurationSeconds', () => {
  const now = new Date('2024-01-01T01:00:00Z');

  it('measures an ended open period from its start to its end', () => {
    const openPeriod = GroupOpenPeriodFixture({
      start: '2024-01-01T00:00:00Z',
      end: '2024-01-01T00:05:00Z',
    });

    expect(getOpenPeriodDurationSeconds(openPeriod, now)).toBe(300);
  });

  it('measures an ongoing open period from its start to now', () => {
    const openPeriod = GroupOpenPeriodFixture({
      start: '2024-01-01T00:00:00Z',
      end: null,
      isOpen: true,
    });

    expect(getOpenPeriodDurationSeconds(openPeriod, now)).toBe(3600);
  });
});
