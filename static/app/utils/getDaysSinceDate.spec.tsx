import {resetMockDate, setMockDate} from 'sentry-test/utils';

import getDaysSinceDate from 'sentry/utils/getDaysSinceDate';

describe('getDaysSinceDate', () => {
  beforeEach(() => {
    setMockDate(1654492173000);
  });

  afterEach(() => {
    resetMockDate();
  });

  it('simple test', () => {
    expect(getDaysSinceDate('2022-05-11')).toBe(26);
  });
  it('deprecated date format', () => {
    expect(getDaysSinceDate('Thu May 11 2022')).toBe(26);
  });
  it('iso string', () => {
    expect(getDaysSinceDate('2022-05-11T17:19:18.307Z')).toBe(26);
  });
  it('iso string 23:59', () => {
    expect(getDaysSinceDate('2022-05-11T23:59:59.900Z')).toBe(26);
  });
  it('iso string 00:00', () => {
    expect(getDaysSinceDate('2022-05-11T00:00:00.100Z')).toBe(26);
  });
});
