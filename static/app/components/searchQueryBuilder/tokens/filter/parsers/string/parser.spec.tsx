import {parseMultiSelectFilterValue} from 'sentry/components/searchQueryBuilder/tokens/filter/parsers/string/parser';

describe('parseMultiSelectValue', function () {
  it('single value', function () {
    const result = parseMultiSelectFilterValue('a');

    expect(result).not.toBeNull();

    expect(result!.items).toHaveLength(1);
    expect(result!.items[0]!.value?.value).toBe('a');
  });

  it('multiple value', function () {
    const result = parseMultiSelectFilterValue('a,b,c');

    expect(result).not.toBeNull();

    expect(result!.items).toHaveLength(3);
    expect(result?.items[0]!.value?.value).toBe('a');
    expect(result?.items[1]!.value?.value).toBe('b');
    expect(result?.items[2]!.value?.value).toBe('c');
  });

  it('quoted value', function () {
    const result = parseMultiSelectFilterValue('a,"b",c');

    expect(result).not.toBeNull();

    expect(result!.items).toHaveLength(3);
    expect(result?.items[0]!.value?.value).toBe('a');

    expect(result?.items[1]!.value?.value).toBe('b');
    expect(result?.items[1]!.value?.text).toBe('"b"');
    expect(result?.items[1]!.value?.quoted).toBe(true);

    expect(result!.items[2]!.value?.value).toBe('c');
  });

  it('just quotes', function () {
    const result = parseMultiSelectFilterValue('""');

    expect(result).not.toBeNull();

    expect(result!.items).toHaveLength(1);
    const item = result!.items[0];

    expect(item!.value?.value).toBe('');
    expect(item!.value?.text).toBe('""');
    expect(item!.value?.quoted).toBe(true);
  });

  it('single empty value', function () {
    const result = parseMultiSelectFilterValue('');

    expect(result).not.toBeNull();

    expect(result!.items).toHaveLength(1);
    const item = result!.items[0];

    expect(item!.value!.value).toBe('');
  });

  it('multiple empty value', function () {
    const result = parseMultiSelectFilterValue('a,,b');

    expect(result).not.toBeNull();

    expect(result!.items).toHaveLength(3);

    expect(result?.items[0]!.value?.value).toBe('a');
    expect(result?.items[1]!.value?.value).toBe('');
    expect(result?.items[2]!.value?.value).toBe('b');
  });

  it('trailing comma', function () {
    const result = parseMultiSelectFilterValue('a,');

    expect(result).not.toBeNull();

    expect(result!.items).toHaveLength(2);

    expect(result?.items[0]!.value?.value).toBe('a');
    expect(result?.items[1]!.value?.value).toBe('');
  });

  it('spaces', function () {
    const result = parseMultiSelectFilterValue('a,b c,d');

    expect(result).not.toBeNull();

    expect(result!.items).toHaveLength(3);

    expect(result?.items[0]!.value?.value).toBe('a');
    expect(result?.items[1]!.value?.value).toBe('b c');
    expect(result?.items[2]!.value?.value).toBe('d');
  });

  describe('contains', function () {
    describe('when the value is wrapped in asterisks', function () {
      it('sets contains to true', function () {
        const result = parseMultiSelectFilterValue('*a*');

        expect(result).not.toBeNull();
        expect(result!.items[0]!.value?.contains).toBe(true);
      });
    });

    describe('when the value is not wrapped in asterisks', function () {
      it('sets contains to false', function () {
        const result = parseMultiSelectFilterValue('a');

        expect(result).not.toBeNull();
        expect(result!.items[0]!.value?.contains).toBe(false);
      });
    });

    it('strips asterisks from the value', function () {
      const singleEntry = parseMultiSelectFilterValue('*a*');
      expect(singleEntry!.items[0]!.value?.value).toBe('a');

      const multipleEntries = parseMultiSelectFilterValue('*a*,*b*,*c*');
      expect(multipleEntries?.items[0]!.value?.value).toBe('a');
      expect(multipleEntries?.items[1]!.value?.value).toBe('b');
      expect(multipleEntries?.items[2]!.value?.value).toBe('c');

      const multiQuoteValue = parseMultiSelectFilterValue('*a*,*"b"*,*c*');
      expect(multiQuoteValue?.items[0]!.value?.value).toBe('a');
      expect(multiQuoteValue?.items[1]!.value?.value).toBe('b');
      expect(multiQuoteValue?.items[1]!.value?.text).toBe('"b"');
      expect(multiQuoteValue?.items[1]!.value?.quoted).toBe(true);
      expect(multiQuoteValue!.items[2]!.value?.value).toBe('c');

      const justQuotes = parseMultiSelectFilterValue('*""*');
      expect(justQuotes?.items[0]!.value?.value).toBe('');
      expect(justQuotes?.items[0]!.value?.text).toBe('""');
      expect(justQuotes?.items[0]!.value?.quoted).toBe(true);

      const multiValuesWithEmpty = parseMultiSelectFilterValue('*a*,**,*b*');
      expect(multiValuesWithEmpty?.items[0]!.value?.value).toBe('a');
      expect(multiValuesWithEmpty?.items[1]!.value?.value).toBe('');
      expect(multiValuesWithEmpty?.items[2]!.value?.value).toBe('b');

      const trailingComma = parseMultiSelectFilterValue('*a*,**');
      expect(trailingComma?.items[0]!.value?.value).toBe('a');
      expect(trailingComma?.items[1]!.value?.value).toBe('');

      const spaces = parseMultiSelectFilterValue('*a*,*b c*,*d*');
      expect(spaces?.items[0]!.value?.value).toBe('a');
      expect(spaces?.items[1]!.value?.value).toBe('b c');
      expect(spaces?.items[2]!.value?.value).toBe('d');
    });
  });
});
