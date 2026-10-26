import {parseDetectorDraftValues} from 'sentry/views/detectors/components/forms/common/detectorDraft';
import {CRON_DETECTOR_DRAFT_CONFIG} from 'sentry/views/detectors/components/forms/cron/cronDraftConfig';

describe('CRON_DETECTOR_DRAFT_CONFIG', () => {
  it('converts edited number inputs to numbers', () => {
    const values = parseDetectorDraftValues(CRON_DETECTOR_DRAFT_CONFIG, {
      checkinMargin: '5',
      failureIssueThreshold: '2',
      scheduleIntervalValue: 3,
    });

    expect(values).toEqual({
      checkinMargin: 5,
      failureIssueThreshold: 2,
      scheduleIntervalValue: 3,
    });
  });

  it('keeps cleared optional numbers empty', () => {
    const values = parseDetectorDraftValues(CRON_DETECTOR_DRAFT_CONFIG, {
      checkinMargin: '',
      maxRuntime: null,
      recoveryThreshold: '',
    });

    expect(values).toEqual({checkinMargin: null, maxRuntime: null});
  });

  it('drops unknown interval units and timezones', () => {
    const values = parseDetectorDraftValues(CRON_DETECTOR_DRAFT_CONFIG, {
      scheduleIntervalUnit: 'fortnight',
      timezone: 'Mars/Olympus_Mons',
    });

    expect(values).toEqual({});
  });

  it('uses the canonical timezone name when given a different case', () => {
    const values = parseDetectorDraftValues(CRON_DETECTOR_DRAFT_CONFIG, {
      timezone: 'utc',
    });

    expect(values).toEqual({timezone: 'UTC'});
  });

  it('keeps known interval units and timezones', () => {
    const values = parseDetectorDraftValues(CRON_DETECTOR_DRAFT_CONFIG, {
      scheduleIntervalUnit: 'hour',
      timezone: 'UTC',
    });

    expect(values).toEqual({scheduleIntervalUnit: 'hour', timezone: 'UTC'});
  });
});
