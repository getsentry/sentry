import {CRON_DETECTOR_DRAFT_SCHEMA} from 'sentry/views/detectors/components/forms/cron/cronDraftConfig';

describe('CRON_DETECTOR_DRAFT_SCHEMA', () => {
  it('converts edited number inputs to numbers', () => {
    const values = CRON_DETECTOR_DRAFT_SCHEMA.parse({
      checkinMargin: '5',
      failureIssueThreshold: '2',
      scheduleIntervalValue: 3,
    });

    expect(values).toStrictEqual({
      checkinMargin: 5,
      failureIssueThreshold: 2,
      scheduleIntervalValue: 3,
    });
  });

  it('keeps cleared optional numbers empty', () => {
    const values = CRON_DETECTOR_DRAFT_SCHEMA.parse({
      checkinMargin: '',
      maxRuntime: null,
      recoveryThreshold: '',
    });

    expect(values).toStrictEqual({
      checkinMargin: null,
      maxRuntime: null,
      recoveryThreshold: undefined,
    });
  });

  it('drops unknown interval units and timezones', () => {
    const values = CRON_DETECTOR_DRAFT_SCHEMA.parse({
      scheduleIntervalUnit: 'fortnight',
      timezone: 'Mars/Olympus_Mons',
    });

    expect(values).toStrictEqual({scheduleIntervalUnit: undefined, timezone: undefined});
  });

  it('uses the canonical timezone name when given a different case', () => {
    const values = CRON_DETECTOR_DRAFT_SCHEMA.parse({
      timezone: 'utc',
    });

    expect(values).toStrictEqual({timezone: 'UTC'});
  });

  it('keeps known interval units and timezones', () => {
    const values = CRON_DETECTOR_DRAFT_SCHEMA.parse({
      scheduleIntervalUnit: 'hour',
      timezone: 'UTC',
    });

    expect(values).toStrictEqual({scheduleIntervalUnit: 'hour', timezone: 'UTC'});
  });
});
