import {DATA_CATEGORY_INFO} from 'sentry/constants';
import {getReasonGroupName} from 'sentry/views/organizationStats/getReasonGroupName';
import {formatUsageWithUnits} from 'sentry/views/organizationStats/utils';

const MILLION = 10 ** 6;
const BILLION = 10 ** 9;
const GIGABYTE = 10 ** 9;

describe('formatUsageWithUnits', function () {
  it('returns correct strings for Errors', function () {
    expect(formatUsageWithUnits(0, DATA_CATEGORY_INFO.error.plural)).toBe('0');
    expect(formatUsageWithUnits(1000, DATA_CATEGORY_INFO.error.plural)).toBe('1,000');
    expect(formatUsageWithUnits(MILLION, DATA_CATEGORY_INFO.error.plural)).toBe(
      '1,000,000'
    );
    expect(formatUsageWithUnits(BILLION, DATA_CATEGORY_INFO.error.plural)).toBe(
      '1,000,000,000'
    );

    expect(
      formatUsageWithUnits(0, DATA_CATEGORY_INFO.error.plural, {isAbbreviated: true})
    ).toBe('0');
    expect(
      formatUsageWithUnits(1000, DATA_CATEGORY_INFO.error.plural, {isAbbreviated: true})
    ).toBe('1K');
    expect(
      formatUsageWithUnits(MILLION, DATA_CATEGORY_INFO.error.plural, {
        isAbbreviated: true,
      })
    ).toBe('1M');
    expect(
      formatUsageWithUnits(1.234 * MILLION, DATA_CATEGORY_INFO.error.plural, {
        isAbbreviated: true,
      })
    ).toBe('1.2M');
    expect(
      formatUsageWithUnits(1.234 * BILLION, DATA_CATEGORY_INFO.error.plural, {
        isAbbreviated: true,
      })
    ).toBe('1.23B');
  });

  it('returns correct strings for Transactions', function () {
    expect(formatUsageWithUnits(0, DATA_CATEGORY_INFO.transaction.plural)).toBe('0');
    expect(formatUsageWithUnits(1000, DATA_CATEGORY_INFO.transaction.plural)).toBe(
      '1,000'
    );
    expect(formatUsageWithUnits(MILLION, DATA_CATEGORY_INFO.transaction.plural)).toBe(
      '1,000,000'
    );
    expect(formatUsageWithUnits(BILLION, DATA_CATEGORY_INFO.transaction.plural)).toBe(
      '1,000,000,000'
    );

    expect(
      formatUsageWithUnits(0, DATA_CATEGORY_INFO.transaction.plural, {
        isAbbreviated: true,
      })
    ).toBe('0');
    expect(
      formatUsageWithUnits(1000, DATA_CATEGORY_INFO.transaction.plural, {
        isAbbreviated: true,
      })
    ).toBe('1K');
    expect(
      formatUsageWithUnits(MILLION, DATA_CATEGORY_INFO.transaction.plural, {
        isAbbreviated: true,
      })
    ).toBe('1M');
    expect(
      formatUsageWithUnits(1.234 * MILLION, DATA_CATEGORY_INFO.transaction.plural, {
        isAbbreviated: true,
      })
    ).toBe('1.2M');
    expect(
      formatUsageWithUnits(1.234 * BILLION, DATA_CATEGORY_INFO.transaction.plural, {
        isAbbreviated: true,
      })
    ).toBe('1.23B');
  });

  it('returns correct strings for Attachments', function () {
    expect(formatUsageWithUnits(0, DATA_CATEGORY_INFO.attachment.plural)).toBe('0 GB');
    expect(formatUsageWithUnits(MILLION, DATA_CATEGORY_INFO.attachment.plural)).toBe(
      '0 GB'
    );
    expect(formatUsageWithUnits(BILLION, DATA_CATEGORY_INFO.attachment.plural)).toBe(
      '1 GB'
    );
    expect(
      formatUsageWithUnits(1.234 * BILLION, DATA_CATEGORY_INFO.attachment.plural)
    ).toBe('1.23 GB');
    expect(
      formatUsageWithUnits(1234 * GIGABYTE, DATA_CATEGORY_INFO.attachment.plural)
    ).toBe('1,234 GB');

    expect(
      formatUsageWithUnits(0, DATA_CATEGORY_INFO.attachment.plural, {isAbbreviated: true})
    ).toBe('0 GB');
    expect(
      formatUsageWithUnits(MILLION, DATA_CATEGORY_INFO.attachment.plural, {
        isAbbreviated: true,
      })
    ).toBe('0 GB');
    expect(
      formatUsageWithUnits(BILLION, DATA_CATEGORY_INFO.attachment.plural, {
        isAbbreviated: true,
      })
    ).toBe('1 GB');
    expect(
      formatUsageWithUnits(1.234 * BILLION, DATA_CATEGORY_INFO.attachment.plural, {
        isAbbreviated: true,
      })
    ).toBe('1 GB');
    expect(
      formatUsageWithUnits(1234 * BILLION, DATA_CATEGORY_INFO.attachment.plural, {
        isAbbreviated: true,
      })
    ).toBe('1.2K GB');

    expect(
      formatUsageWithUnits(0, DATA_CATEGORY_INFO.attachment.plural, {
        useUnitScaling: true,
      })
    ).toBe('0 B');
    expect(
      formatUsageWithUnits(1000, DATA_CATEGORY_INFO.attachment.plural, {
        useUnitScaling: true,
      })
    ).toBe('1 KB');
    expect(
      formatUsageWithUnits(MILLION, DATA_CATEGORY_INFO.attachment.plural, {
        useUnitScaling: true,
      })
    ).toBe('1 MB');
    expect(
      formatUsageWithUnits(1.234 * MILLION, DATA_CATEGORY_INFO.attachment.plural, {
        useUnitScaling: true,
      })
    ).toBe('1.23 MB');
    expect(
      formatUsageWithUnits(1.234 * BILLION, DATA_CATEGORY_INFO.attachment.plural, {
        useUnitScaling: true,
      })
    ).toBe('1.23 GB');
    expect(
      formatUsageWithUnits(1234 * BILLION, DATA_CATEGORY_INFO.attachment.plural, {
        useUnitScaling: true,
      })
    ).toBe('1.23 TB');
  });

  it('should format profile duration correctly', function () {
    const hourInMs = 1000 * 60 * 60;
    expect(formatUsageWithUnits(0, DATA_CATEGORY_INFO.profileDuration.plural)).toBe('0');
    expect(
      formatUsageWithUnits(7.6 * hourInMs, DATA_CATEGORY_INFO.profileDuration.plural)
    ).toBe('7.6');
    expect(
      formatUsageWithUnits(hourInMs, DATA_CATEGORY_INFO.profileDuration.plural)
    ).toBe('1');
    expect(
      formatUsageWithUnits(24 * hourInMs, DATA_CATEGORY_INFO.profileDuration.plural)
    ).toBe('24');
  });

  it('Correctly groups invalid outcome reasons', function () {
    expect(getReasonGroupName('invalid', 'duplicate_item')).toBe('invalid_request');
    expect(getReasonGroupName('invalid', 'too_large')).toBe('too_large');
    expect(getReasonGroupName('invalid', 'some_other_reason')).toBe('internal');
  });
});
