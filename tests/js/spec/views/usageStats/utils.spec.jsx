import {DataCategory} from 'app/types';
import {
  BILLION,
  formatUsageWithUnits,
  GIGABYTE,
  MILLION,
} from 'app/views/usageStats/utils';

describe('formatUsageWithUnits', function () {
  it('returns correct strings for Errors', function () {
    expect(formatUsageWithUnits(0, DataCategory.ERRORS)).toBe('0');
    expect(formatUsageWithUnits(1000, DataCategory.ERRORS)).toBe('1,000');
    expect(formatUsageWithUnits(MILLION, DataCategory.ERRORS)).toBe('1,000,000');
    expect(formatUsageWithUnits(BILLION, DataCategory.ERRORS)).toBe('1,000,000,000');

    expect(formatUsageWithUnits(0, DataCategory.ERRORS, {isAbbreviated: true})).toBe('0');
    expect(formatUsageWithUnits(1000, DataCategory.ERRORS, {isAbbreviated: true})).toBe(
      '1K'
    );
    expect(
      formatUsageWithUnits(MILLION, DataCategory.ERRORS, {isAbbreviated: true})
    ).toBe('1M');
    expect(
      formatUsageWithUnits(1.234 * MILLION, DataCategory.ERRORS, {
        isAbbreviated: true,
      })
    ).toBe('1.2M');
    expect(
      formatUsageWithUnits(1.234 * BILLION, DataCategory.ERRORS, {
        isAbbreviated: true,
      })
    ).toBe('1.23B');
  });

  it('returns correct strings for Transactions', function () {
    expect(formatUsageWithUnits(0, DataCategory.TRANSACTIONS)).toBe('0');
    expect(formatUsageWithUnits(1000, DataCategory.TRANSACTIONS)).toBe('1,000');
    expect(formatUsageWithUnits(MILLION, DataCategory.TRANSACTIONS)).toBe('1,000,000');
    expect(formatUsageWithUnits(BILLION, DataCategory.TRANSACTIONS)).toBe(
      '1,000,000,000'
    );

    expect(
      formatUsageWithUnits(0, DataCategory.TRANSACTIONS, {isAbbreviated: true})
    ).toBe('0');
    expect(
      formatUsageWithUnits(1000, DataCategory.TRANSACTIONS, {isAbbreviated: true})
    ).toBe('1K');
    expect(
      formatUsageWithUnits(MILLION, DataCategory.TRANSACTIONS, {isAbbreviated: true})
    ).toBe('1M');
    expect(
      formatUsageWithUnits(1.234 * MILLION, DataCategory.TRANSACTIONS, {
        isAbbreviated: true,
      })
    ).toBe('1.2M');
    expect(
      formatUsageWithUnits(1.234 * BILLION, DataCategory.TRANSACTIONS, {
        isAbbreviated: true,
      })
    ).toBe('1.23B');
  });

  it('returns correct strings for Attachments', function () {
    expect(formatUsageWithUnits(0, DataCategory.ATTACHMENTS)).toBe('0 GB');
    expect(formatUsageWithUnits(MILLION, DataCategory.ATTACHMENTS)).toBe('0 GB');
    expect(formatUsageWithUnits(BILLION, DataCategory.ATTACHMENTS)).toBe('1 GB');
    expect(formatUsageWithUnits(1.234 * BILLION, DataCategory.ATTACHMENTS)).toBe(
      '1.23 GB'
    );
    expect(formatUsageWithUnits(1234 * GIGABYTE, DataCategory.ATTACHMENTS)).toBe(
      '1,234 GB'
    );

    expect(formatUsageWithUnits(0, DataCategory.ATTACHMENTS, {isAbbreviated: true})).toBe(
      '0 GB'
    );
    expect(
      formatUsageWithUnits(MILLION, DataCategory.ATTACHMENTS, {isAbbreviated: true})
    ).toBe('0 GB');
    expect(
      formatUsageWithUnits(BILLION, DataCategory.ATTACHMENTS, {isAbbreviated: true})
    ).toBe('1 GB');
    expect(
      formatUsageWithUnits(1.234 * BILLION, DataCategory.ATTACHMENTS, {
        isAbbreviated: true,
      })
    ).toBe('1 GB');
    expect(
      formatUsageWithUnits(1234 * BILLION, DataCategory.ATTACHMENTS, {
        isAbbreviated: true,
      })
    ).toBe('1K GB');

    expect(
      formatUsageWithUnits(0, DataCategory.ATTACHMENTS, {
        useUnitScaling: true,
      })
    ).toBe('0 B');
    expect(
      formatUsageWithUnits(1000, DataCategory.ATTACHMENTS, {
        useUnitScaling: true,
      })
    ).toBe('1 KB');
    expect(
      formatUsageWithUnits(MILLION, DataCategory.ATTACHMENTS, {
        useUnitScaling: true,
      })
    ).toBe('1 MB');
    expect(
      formatUsageWithUnits(1.234 * MILLION, DataCategory.ATTACHMENTS, {
        useUnitScaling: true,
      })
    ).toBe('1.23 MB');
    expect(
      formatUsageWithUnits(1.234 * BILLION, DataCategory.ATTACHMENTS, {
        useUnitScaling: true,
      })
    ).toBe('1.23 GB');
    expect(
      formatUsageWithUnits(1234 * BILLION, DataCategory.ATTACHMENTS, {
        useUnitScaling: true,
      })
    ).toBe('1.23 TB');
  });
});
