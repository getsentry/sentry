import {DataCategory} from 'app/types';
import {
  BILLION,
  formatUsageWithUnits,
  GIGABYTE,
  MILLION,
} from 'app/views/usageStats/utils';

describe('formatUsageWithUnits', function () {
  it('returns correct strings for Errors', function () {
    expect(formatUsageWithUnits(0, DataCategory.ERROR)).toBe('0');
    expect(formatUsageWithUnits(1000, DataCategory.ERROR)).toBe('1,000');
    expect(formatUsageWithUnits(MILLION, DataCategory.ERROR)).toBe('1,000,000');
    expect(formatUsageWithUnits(BILLION, DataCategory.ERROR)).toBe('1,000,000,000');

    expect(formatUsageWithUnits(0, DataCategory.ERROR, {isAbbreviated: true})).toBe('0');
    expect(formatUsageWithUnits(1000, DataCategory.ERROR, {isAbbreviated: true})).toBe(
      '1K'
    );
    expect(formatUsageWithUnits(MILLION, DataCategory.ERROR, {isAbbreviated: true})).toBe(
      '1M'
    );
    expect(
      formatUsageWithUnits(1.234 * MILLION, DataCategory.ERROR, {
        isAbbreviated: true,
      })
    ).toBe('1.2M');
    expect(
      formatUsageWithUnits(1.234 * BILLION, DataCategory.ERROR, {
        isAbbreviated: true,
      })
    ).toBe('1.23B');
  });

  it('returns correct strings for Transactions', function () {
    expect(formatUsageWithUnits(0, DataCategory.TRANSACTION)).toBe('0');
    expect(formatUsageWithUnits(1000, DataCategory.TRANSACTION)).toBe('1,000');
    expect(formatUsageWithUnits(MILLION, DataCategory.TRANSACTION)).toBe('1,000,000');
    expect(formatUsageWithUnits(BILLION, DataCategory.TRANSACTION)).toBe('1,000,000,000');

    expect(formatUsageWithUnits(0, DataCategory.TRANSACTION, {isAbbreviated: true})).toBe(
      '0'
    );
    expect(
      formatUsageWithUnits(1000, DataCategory.TRANSACTION, {isAbbreviated: true})
    ).toBe('1K');
    expect(
      formatUsageWithUnits(MILLION, DataCategory.TRANSACTION, {isAbbreviated: true})
    ).toBe('1M');
    expect(
      formatUsageWithUnits(1.234 * MILLION, DataCategory.TRANSACTION, {
        isAbbreviated: true,
      })
    ).toBe('1.2M');
    expect(
      formatUsageWithUnits(1.234 * BILLION, DataCategory.TRANSACTION, {
        isAbbreviated: true,
      })
    ).toBe('1.23B');
  });

  it('returns correct strings for Attachments', function () {
    expect(formatUsageWithUnits(0, DataCategory.ATTACHMENT)).toBe('0 GB');
    expect(formatUsageWithUnits(MILLION, DataCategory.ATTACHMENT)).toBe('0 GB');
    expect(formatUsageWithUnits(BILLION, DataCategory.ATTACHMENT)).toBe('1 GB');
    expect(formatUsageWithUnits(1.234 * BILLION, DataCategory.ATTACHMENT)).toBe(
      '1.23 GB'
    );
    expect(formatUsageWithUnits(1234 * GIGABYTE, DataCategory.ATTACHMENT)).toBe(
      '1,234 GB'
    );

    expect(formatUsageWithUnits(0, DataCategory.ATTACHMENT, {isAbbreviated: true})).toBe(
      '0 GB'
    );
    expect(
      formatUsageWithUnits(MILLION, DataCategory.ATTACHMENT, {isAbbreviated: true})
    ).toBe('0 GB');
    expect(
      formatUsageWithUnits(BILLION, DataCategory.ATTACHMENT, {isAbbreviated: true})
    ).toBe('1 GB');
    expect(
      formatUsageWithUnits(1.234 * BILLION, DataCategory.ATTACHMENT, {
        isAbbreviated: true,
      })
    ).toBe('1 GB');
    expect(
      formatUsageWithUnits(1234 * BILLION, DataCategory.ATTACHMENT, {
        isAbbreviated: true,
      })
    ).toBe('1K GB');

    expect(
      formatUsageWithUnits(0, DataCategory.ATTACHMENT, {
        useUnitScaling: true,
      })
    ).toBe('0 B');
    expect(
      formatUsageWithUnits(1000, DataCategory.ATTACHMENT, {
        useUnitScaling: true,
      })
    ).toBe('1 KB');
    expect(
      formatUsageWithUnits(MILLION, DataCategory.ATTACHMENT, {
        useUnitScaling: true,
      })
    ).toBe('1 MB');
    expect(
      formatUsageWithUnits(1.234 * MILLION, DataCategory.ATTACHMENT, {
        useUnitScaling: true,
      })
    ).toBe('1.23 MB');
    expect(
      formatUsageWithUnits(1.234 * BILLION, DataCategory.ATTACHMENT, {
        useUnitScaling: true,
      })
    ).toBe('1.23 GB');
    expect(
      formatUsageWithUnits(1234 * BILLION, DataCategory.ATTACHMENT, {
        useUnitScaling: true,
      })
    ).toBe('1.23 TB');
  });
});
