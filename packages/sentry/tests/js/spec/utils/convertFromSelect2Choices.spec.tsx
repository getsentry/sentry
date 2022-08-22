import convertFromSelect2Choices from 'sentry/utils/convertFromSelect2Choices';

describe('convertFromSelect2Choices', function () {
  it('changes a flat array of strings into array of {label, value}', function () {
    expect(convertFromSelect2Choices(['a', 'b', 'c'])).toEqual([
      {
        label: 'a',
        value: 'a',
      },
      {
        label: 'b',
        value: 'b',
      },
      {
        label: 'c',
        value: 'c',
      },
    ]);
  });

  it('changes a paired array of strings into array of {label, value}', function () {
    expect(
      convertFromSelect2Choices([
        ['a', 'A'],
        ['b', 'B'],
        ['c', 'C'],
      ])
    ).toEqual([
      {
        label: 'A',
        value: 'a',
      },
      {
        label: 'B',
        value: 'b',
      },
      {
        label: 'C',
        value: 'c',
      },
    ]);
  });

  it('returns null on invalid values', function () {
    expect(convertFromSelect2Choices('test')).toBeUndefined();
    expect(convertFromSelect2Choices(1)).toBeUndefined();
    expect(convertFromSelect2Choices({})).toBeUndefined();
    expect(convertFromSelect2Choices(undefined)).toBeUndefined();
  });
});
