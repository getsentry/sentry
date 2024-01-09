import {DATA_CATEGORY_INFO} from 'sentry/constants';
import {formatUsageWithUnits} from 'sentry/views/organizationStats/utils';

describe('formatUsageWithUnits', function () {
  it('returns correct strings for Errors', function () {
    expect(formatUsageWithUnits(0, DATA_CATEGORY_INFO.error.plural)).toBe('0');
    expect(formatUsageWithUnits(1000, DATA_CATEGORY_INFO.error.plural)).toBe('1,000');
    expect(formatUsageWithUnits(1e6, DATA_CATEGORY_INFO.error.plural)).toBe('1,000,000');
    expect(formatUsageWithUnits(1e9, DATA_CATEGORY_INFO.error.plural)).toBe(
      '1,000,000,000'
    );

    expect(
      formatUsageWithUnits(0, DATA_CATEGORY_INFO.error.plural, {isAbbreviated: true})
    ).toBe('0');
    expect(
      formatUsageWithUnits(1000, DATA_CATEGORY_INFO.error.plural, {isAbbreviated: true})
    ).toBe('1K');
    expect(
      formatUsageWithUnits(1e6, DATA_CATEGORY_INFO.error.plural, {
        isAbbreviated: true,
      })
    ).toBe('1M');
    expect(
      formatUsageWithUnits(1.234 * 1e6, DATA_CATEGORY_INFO.error.plural, {
        isAbbreviated: true,
      })
    ).toBe('1.2M');
    expect(
      formatUsageWithUnits(1.234 * 1e9, DATA_CATEGORY_INFO.error.plural, {
        isAbbreviated: true,
      })
    ).toBe('1.23B');
  });

  it('returns correct strings for Transactions', function () {
    expect(formatUsageWithUnits(0, DATA_CATEGORY_INFO.transaction.plural)).toBe('0');
    expect(formatUsageWithUnits(1000, DATA_CATEGORY_INFO.transaction.plural)).toBe(
      '1,000'
    );
    expect(formatUsageWithUnits(1e6, DATA_CATEGORY_INFO.transaction.plural)).toBe(
      '1,000,000'
    );
    expect(formatUsageWithUnits(1e9, DATA_CATEGORY_INFO.transaction.plural)).toBe(
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
      formatUsageWithUnits(1e6, DATA_CATEGORY_INFO.transaction.plural, {
        isAbbreviated: true,
      })
    ).toBe('1M');
    expect(
      formatUsageWithUnits(1.234 * 1e6, DATA_CATEGORY_INFO.transaction.plural, {
        isAbbreviated: true,
      })
    ).toBe('1.2M');
    expect(
      formatUsageWithUnits(1.234 * 1e9, DATA_CATEGORY_INFO.transaction.plural, {
        isAbbreviated: true,
      })
    ).toBe('1.23B');
  });

  it('returns correct strings for Attachments', function () {
    expect(formatUsageWithUnits(0, DATA_CATEGORY_INFO.attachment.plural)).toBe('0 GB');
    expect(formatUsageWithUnits(1e6, DATA_CATEGORY_INFO.attachment.plural)).toBe('0 GB');
    expect(formatUsageWithUnits(1e9, DATA_CATEGORY_INFO.attachment.plural)).toBe('1 GB');
    expect(formatUsageWithUnits(1.234 * 1e9, DATA_CATEGORY_INFO.attachment.plural)).toBe(
      '1.23 GB'
    );
    expect(formatUsageWithUnits(1234 * 1e9, DATA_CATEGORY_INFO.attachment.plural)).toBe(
      '1,234 GB'
    );

    expect(
      formatUsageWithUnits(0, DATA_CATEGORY_INFO.attachment.plural, {isAbbreviated: true})
    ).toBe('0 GB');
    expect(
      formatUsageWithUnits(1e6, DATA_CATEGORY_INFO.attachment.plural, {
        isAbbreviated: true,
      })
    ).toBe('0 GB');
    expect(
      formatUsageWithUnits(1e9, DATA_CATEGORY_INFO.attachment.plural, {
        isAbbreviated: true,
      })
    ).toBe('1 GB');
    expect(
      formatUsageWithUnits(1.234 * 1e9, DATA_CATEGORY_INFO.attachment.plural, {
        isAbbreviated: true,
      })
    ).toBe('1 GB');
    expect(
      formatUsageWithUnits(1234 * 1e9, DATA_CATEGORY_INFO.attachment.plural, {
        isAbbreviated: true,
      })
    ).toBe('1K GB');

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
      formatUsageWithUnits(1e6, DATA_CATEGORY_INFO.attachment.plural, {
        useUnitScaling: true,
      })
    ).toBe('1 MB');
    expect(
      formatUsageWithUnits(1.234 * 1e6, DATA_CATEGORY_INFO.attachment.plural, {
        useUnitScaling: true,
      })
    ).toBe('1.23 MB');
    expect(
      formatUsageWithUnits(1.234 * 1e9, DATA_CATEGORY_INFO.attachment.plural, {
        useUnitScaling: true,
      })
    ).toBe('1.23 GB');
    expect(
      formatUsageWithUnits(1234 * 1e9, DATA_CATEGORY_INFO.attachment.plural, {
        useUnitScaling: true,
      })
    ).toBe('1.23 TB');
  });
});
