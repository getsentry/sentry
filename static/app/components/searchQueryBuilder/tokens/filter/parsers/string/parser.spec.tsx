import {parseMultiSelectFilterValue} from 'sentry/components/searchQueryBuilder/tokens/filter/parsers/string/parser';

describe('parseMultiSelectValue', () => {
  it('single value', () => {
    const result = parseMultiSelectFilterValue('a');

    expect(result).not.toBeNull();

    expect(result!.items).toHaveLength(1);
    expect(result!.items[0]!.value?.value).toBe('a');
  });

  it('multiple value', () => {
    const result = parseMultiSelectFilterValue('a,b,c');

    expect(result).not.toBeNull();

    expect(result!.items).toHaveLength(3);
    expect(result?.items[0]!.value?.value).toBe('a');
    expect(result?.items[1]!.value?.value).toBe('b');
    expect(result?.items[2]!.value?.value).toBe('c');
  });

  it('quoted value', () => {
    const result = parseMultiSelectFilterValue('a,"b",c');

    expect(result).not.toBeNull();

    expect(result!.items).toHaveLength(3);
    expect(result?.items[0]!.value?.value).toBe('a');

    expect(result?.items[1]!.value?.value).toBe('b');
    expect(result?.items[1]!.value?.text).toBe('"b"');
    expect(result?.items[1]!.value?.quoted).toBe(true);

    expect(result!.items[2]!.value?.value).toBe('c');
  });

  it('just quotes', () => {
    const result = parseMultiSelectFilterValue('""');

    expect(result).not.toBeNull();

    expect(result!.items).toHaveLength(1);
    const item = result!.items[0];

    expect(item!.value?.value).toBe('');
    expect(item!.value?.text).toBe('""');
    expect(item!.value?.quoted).toBe(true);
  });

  it('single empty value', () => {
    const result = parseMultiSelectFilterValue('');

    expect(result).not.toBeNull();

    expect(result!.items).toHaveLength(1);
    const item = result!.items[0];

    expect(item!.value!.value).toBe('');
  });

  it('multiple empty value', () => {
    const result = parseMultiSelectFilterValue('a,,b');

    expect(result).not.toBeNull();

    expect(result!.items).toHaveLength(3);

    expect(result?.items[0]!.value?.value).toBe('a');
    expect(result?.items[1]!.value?.value).toBe('');
    expect(result?.items[2]!.value?.value).toBe('b');
  });

  it('trailing comma', () => {
    const result = parseMultiSelectFilterValue('a,');

    expect(result).not.toBeNull();

    expect(result!.items).toHaveLength(2);

    expect(result?.items[0]!.value?.value).toBe('a');
    expect(result?.items[1]!.value?.value).toBe('');
  });

  it('spaces', () => {
    const result = parseMultiSelectFilterValue('a,b c,d');

    expect(result).not.toBeNull();

    expect(result!.items).toHaveLength(3);

    expect(result?.items[0]!.value?.value).toBe('a');
    expect(result?.items[1]!.value?.value).toBe('b c');
    expect(result?.items[2]!.value?.value).toBe('d');
  });

  it('quoted asterisk value', () => {
    const result = parseMultiSelectFilterValue('"**"');

    expect(result).not.toBeNull();

    expect(result!.items).toHaveLength(1);
    const item = result!.items[0];

    expect(item!.value?.value).toBe('**');
    expect(item!.value?.text).toBe('"**"');
    expect(item!.value?.quoted).toBe(true);
  });

  it('single empty asterisk value', () => {
    const result = parseMultiSelectFilterValue('**');

    expect(result).not.toBeNull();

    expect(result!.items).toHaveLength(1);
    const item = result!.items[0];

    expect(item!.value!.value).toBe('**');
    expect(item!.value!.text).toBe('**');
  });
});
