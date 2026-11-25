import {getNextCronFiring, getNextCronFiringBulk} from './utils';

describe('getNextCronFiring', () => {
  // A Friday
  const now = new Date('2026-10-23T09:00:00Z');

  it('returns undefined for a crontab that cannot be read', () => {
    expect(getNextCronFiring({crontab: '', timezone: 'UTC'}, now)).toBeUndefined();
    expect(
      getNextCronFiring({crontab: 'every day', timezone: 'UTC'}, now)
    ).toBeUndefined();
    // Four and six fields
    expect(
      getNextCronFiring({crontab: '0 10 * *', timezone: 'UTC'}, now)
    ).toBeUndefined();
    expect(
      getNextCronFiring({crontab: '0 0 10 * * *', timezone: 'UTC'}, now)
    ).toBeUndefined();
    // Out of range values and a zero step
    expect(
      getNextCronFiring({crontab: '60 10 * * *', timezone: 'UTC'}, now)
    ).toBeUndefined();
    expect(
      getNextCronFiring({crontab: '0 24 * * *', timezone: 'UTC'}, now)
    ).toBeUndefined();
    expect(
      getNextCronFiring({crontab: '*/0 * * * *', timezone: 'UTC'}, now)
    ).toBeUndefined();
  });

  it('returns undefined for an unknown timezone', () => {
    expect(
      getNextCronFiring({crontab: '0 10 * * *', timezone: 'Not/AZone'}, now)
    ).toBeUndefined();
  });

  it('returns undefined for a schedule that never fires', () => {
    // February 31st never happens
    expect(
      getNextCronFiring({crontab: '0 0 31 2 *', timezone: 'UTC'}, now)
    ).toBeUndefined();
  });

  it.each([
    ['later the same day', '0 10 * * *', '2026-10-23T10:00:00.000Z'],
    ['the next day once today has passed', '0 8 * * *', '2026-10-24T08:00:00.000Z'],
    ['strictly after now', '0 9 * * *', '2026-10-24T09:00:00.000Z'],
    ['a list of hours', '0 6,22 * * *', '2026-10-23T22:00:00.000Z'],
    ['a step of minutes', '*/15 * * * *', '2026-10-23T09:15:00.000Z'],
    ['a value with a step', '5/20 * * * *', '2026-10-23T09:05:00.000Z'],
    ['a range of weekdays', '0 8 * * 1-5', '2026-10-26T08:00:00.000Z'],
    ['a named weekday', '0 0 * * sun', '2026-10-25T00:00:00.000Z'],
    ['Sunday written as 7', '0 0 * * 7', '2026-10-25T00:00:00.000Z'],
    ['a day of the month', '0 0 1 * *', '2026-11-01T00:00:00.000Z'],
    ['a named month', '0 0 1 JAN *', '2027-01-01T00:00:00.000Z'],
    ['a leap day', '0 0 29 2 *', '2028-02-29T00:00:00.000Z'],
  ])('finds %s', (_, crontab, expected) => {
    expect(getNextCronFiring({crontab, timezone: 'UTC'}, now)?.toISOString()).toBe(
      expected
    );
  });

  it('fires on either day when day of month and day of week are both set', () => {
    // The 1st, or any Monday. The next Monday comes first
    expect(
      getNextCronFiring({crontab: '0 0 1 * 1', timezone: 'UTC'}, now)?.toISOString()
    ).toBe('2026-10-26T00:00:00.000Z');
  });

  it('evaluates the crontab in its timezone', () => {
    // New York is UTC-4 during daylight saving
    expect(
      getNextCronFiring(
        {crontab: '0 9 * * *', timezone: 'America/New_York'},
        now
      )?.toISOString()
    ).toBe('2026-10-23T13:00:00.000Z');
    // And UTC-5 after it ends on November 1st
    expect(
      getNextCronFiring(
        {crontab: '0 9 * * *', timezone: 'America/New_York'},
        new Date('2026-11-02T00:00:00Z')
      )?.toISOString()
    ).toBe('2026-11-02T14:00:00.000Z');
  });

  it('skips a time that daylight saving removes', () => {
    // 2:30 AM does not exist in New York on March 8th 2026
    expect(
      getNextCronFiring(
        {crontab: '30 2 * * *', timezone: 'America/New_York'},
        new Date('2026-03-08T05:00:00Z')
      )?.toISOString()
    ).toBe('2026-03-09T06:30:00.000Z');
  });
});

describe('getNextCronFiringBulk', () => {
  afterEach(() => {
    try {
      jest.runOnlyPendingTimers();
    } finally {
      jest.useRealTimers();
    }
  });

  it('returns undefined without a schedule that can fire', () => {
    jest.useFakeTimers({now: new Date('2026-10-23T09:00:00Z')});

    expect(getNextCronFiringBulk(undefined)).toBeUndefined();
    expect(getNextCronFiringBulk([])).toBeUndefined();
    expect(
      getNextCronFiringBulk([
        {crontab: 'every day', timezone: 'UTC'},
        {crontab: '0 10 * * *', timezone: 'Not/AZone'},
        {crontab: '0 0 31 2 *', timezone: 'UTC'},
      ])
    ).toBeUndefined();
  });

  it.each([
    ['before 10:00', '2026-10-23T09:59:59Z', '2026-10-23T10:00:00.000Z'],
    ['at 10:00', '2026-10-23T10:00:00Z', '2026-10-23T22:00:00.000Z'],
    ['between 10:00 and 22:00', '2026-10-23T15:30:00Z', '2026-10-23T22:00:00.000Z'],
    ['at 22:00', '2026-10-23T22:00:00Z', '2026-10-24T10:00:00.000Z'],
    ['after 22:00', '2026-10-23T23:15:00Z', '2026-10-24T10:00:00.000Z'],
    [
      'after 22:00 at the end of a month',
      '2026-10-31T23:00:00Z',
      '2026-11-01T10:00:00.000Z',
    ],
    [
      'after 22:00 at the end of a year',
      '2026-12-31T23:00:00Z',
      '2027-01-01T10:00:00.000Z',
    ],
  ])('uses the current time %s UTC', (_, now, expected) => {
    jest.useFakeTimers({now: new Date(now)});

    expect(
      getNextCronFiringBulk([{crontab: '0 10,22 * * *', timezone: 'UTC'}])?.toISOString()
    ).toBe(expected);
  });

  it('picks the closest firing across schedules', () => {
    jest.useFakeTimers({now: new Date('2026-10-23T09:00:00Z')});

    expect(
      getNextCronFiringBulk([
        {crontab: '0 18 * * *', timezone: 'UTC'},
        {crontab: '30 11 * * *', timezone: 'UTC'},
        {crontab: '0 0 1 * *', timezone: 'UTC'},
      ])?.toISOString()
    ).toBe('2026-10-23T11:30:00.000Z');
  });

  it('compares schedules in different timezones by absolute time', () => {
    jest.useFakeTimers({now: new Date('2026-10-23T09:00:00Z')});

    // 8 PM in Tokyo is 11:00 UTC, before 9 AM in New York at 13:00 UTC
    expect(
      getNextCronFiringBulk([
        {crontab: '0 9 * * *', timezone: 'America/New_York'},
        {crontab: '0 20 * * *', timezone: 'Asia/Tokyo'},
      ])?.toISOString()
    ).toBe('2026-10-23T11:00:00.000Z');
  });

  it('ignores schedules that cannot fire', () => {
    jest.useFakeTimers({now: new Date('2026-10-23T09:00:00Z')});

    expect(
      getNextCronFiringBulk([
        {crontab: 'every day', timezone: 'UTC'},
        {crontab: '0 18 * * *', timezone: 'UTC'},
      ])?.toISOString()
    ).toBe('2026-10-23T18:00:00.000Z');
  });
});
