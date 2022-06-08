import getDaysSinceDate from 'sentry/utils/getDaysSinceDate';

jest.mock('moment', () => {
  const moment = jest.requireActual('moment');
  // Jun 06 2022
  moment.now = jest.fn().mockReturnValue(1654492173000);
  return moment;
});

describe('getDaysSinceDate', function () {
  it('simple test', function () {
    expect(getDaysSinceDate('2022-05-11')).toBe(26);
  });
});
