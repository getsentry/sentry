import {parseMultiSelectFilterValue} from 'sentry/components/searchQueryBuilder/tokens/filter/parsers/string/parser';

describe('parseMultiSelectValue', function () {
  it('single value', function () {
    const result = parseMultiSelectFilterValue('a');

    expect(result).not.toBeNull();

    expect(result!.items).toHaveLength(1);
    expect(result!.items[0]!.value?.value).toEqual('a');
  });

  it('multiple value', function () {
    const result = parseMultiSelectFilterValue('a,b,c');

    expect(result).not.toBeNull();

    expect(result!.items).toHaveLength(3);
    expect(result!?.items[0]!.value?.value).toEqual('a');
    expect(result!?.items[1]!.value?.value).toEqual('b');
    expect(result!?.items[2]!.value?.value).toEqual('c');
  });

  it('quoted value', function () {
    const result = parseMultiSelectFilterValue('a,"b",c');

    expect(result).not.toBeNull();

    expect(result!.items).toHaveLength(3);
    expect(result!?.items[0]!.value?.value).toEqual('a');

    expect(result!?.items[1]!.value?.value).toEqual('b');
    expect(result!?.items[1]!.value?.text).toEqual('"b"');
    expect(result!?.items[1]!.value?.quoted).toBe(true);

    expect(result!.items[2]!.value?.value).toEqual('c');
  });

  it('just quotes', function () {
    const result = parseMultiSelectFilterValue('""');

    expect(result).not.toBeNull();

    expect(result!.items).toHaveLength(1);
    const item = result!.items[0];

    expect(item!.value!?.value).toEqual('');
    expect(item!.value!?.text).toEqual('""');
    expect(item!.value!?.quoted).toBe(true);
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

    expect(result!?.items[0]!.value!?.value).toEqual('a');
    expect(result!?.items[1]!.value!?.value).toBe('');
    expect(result!?.items[2]!.value!?.value).toEqual('b');
  });

  it('trailing comma', function () {
    const result = parseMultiSelectFilterValue('a,');

    expect(result).not.toBeNull();

    expect(result!.items).toHaveLength(2);

    expect(result!?.items[0]!.value!?.value).toEqual('a');
    expect(result!?.items[1]!.value!?.value).toBe('');
  });

  it('spaces', function () {
    const result = parseMultiSelectFilterValue('a,b c,d');

    expect(result).not.toBeNull();

    expect(result!.items).toHaveLength(3);

    expect(result!?.items[0]!.value!?.value).toEqual('a');
    expect(result!?.items[1]!.value!?.value).toEqual('b c');
    expect(result!?.items[2]!.value!?.value).toEqual('d');
  });
});
