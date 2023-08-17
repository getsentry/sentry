import isValidDate from 'sentry/utils/date/isValidDate';

describe('isValidDate', () => {
  it.each([
    {label: 'date from string', expected: true, value: new Date('2023/01/01')},
    {label: 'date from int', expected: true, value: new Date(123456)},
    {label: 'date from NaN', expected: false, value: new Date(1 / 0)},
    {label: 'duck type', expected: false, value: {getTime: () => 1}},
    {label: 'object', expected: false, value: {foo: 'bar'}},
  ])('should return {expected} for {label}', ({expected, value}) => {
    expect(isValidDate(value)).toBe(expected);
  });
});
