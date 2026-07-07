import {resetMockDate, setMockDate} from 'sentry-test/utils';

import {logItemIdToTimestamp} from 'sentry/views/explore/logs/pinning/logItemId';

describe('logItemIdToTimestamp', () => {
  beforeEach(() => {
    setMockDate(new Date('2026-06-19T00:00:00Z'));
  });

  afterEach(() => {
    resetMockDate();
  });

  it('decodes the epoch milliseconds from a v7 log id', () => {
    const result = logItemIdToTimestamp('019ed8e2be157592b89c4bd51c7bd1e7');

    expect(result).toBe(Date.parse('2026-06-18T03:59:58.997Z'));
  });

  it('returns null when the id is shorter than the timestamp prefix', () => {
    const result = logItemIdToTimestamp('019ed8');

    expect(result).toBeNull();
  });

  it('returns null when the prefix is not hexadecimal', () => {
    const result = logItemIdToTimestamp('zzzzzzzzzzzz92b89c4bd51c7bd1e7');

    expect(result).toBeNull();
  });

  it('returns null when the decoded time predates the plausible range', () => {
    const result = logItemIdToTimestamp('000000000000b89c4bd51c7bd1e7abcd');

    expect(result).toBeNull();
  });

  it('returns null when the decoded time is far in the future', () => {
    const result = logItemIdToTimestamp('ffffffffffffb89c4bd51c7bd1e7abcd');

    expect(result).toBeNull();
  });
});
