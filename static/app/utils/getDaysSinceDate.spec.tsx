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
});
