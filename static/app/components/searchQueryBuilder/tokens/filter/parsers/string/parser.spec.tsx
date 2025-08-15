import {parseMultiSelectFilterValue} from 'sentry/components/searchQueryBuilder/tokens/filter/parsers/string/parser';
import {WildcardPositions} from 'sentry/components/searchSyntax/parser';

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

  it('sets wildcard to false when not wrapped in `*`', () => {
    const result = parseMultiSelectFilterValue('a');

    expect(result).not.toBeNull();
    expect(result!.items).toHaveLength(1);
    expect(result!.items[0]!.value?.value).toBe('a');
    expect(result!.items[0]!.value?.text).toBe('a');
    expect(result!.items[0]!.value?.wildcard).toBe(false);
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
    expect(item!.value!.wildcard).toBe(false);
  });

  describe('wildcard surrounded', () => {
    it('single value', () => {
      const result = parseMultiSelectFilterValue('*a*');

      expect(result).not.toBeNull();
      expect(result!.items).toHaveLength(1);
      expect(result!.items[0]!.value?.value).toBe('*a*');
      expect(result!.items[0]!.value?.text).toBe('*a*');
      expect(result!.items[0]!.value?.wildcard).toBe(WildcardPositions.SURROUNDED);
    });

    it('multiple value', () => {
      const result = parseMultiSelectFilterValue('*a*,*b*,c');

      expect(result).not.toBeNull();

      expect(result!.items).toHaveLength(3);
      expect(result?.items[0]!.value?.value).toBe('*a*');
      expect(result?.items[0]!.value?.text).toBe('*a*');
      expect(result?.items[0]!.value?.wildcard).toBe(WildcardPositions.SURROUNDED);

      expect(result?.items[1]!.value?.value).toBe('*b*');
      expect(result?.items[1]!.value?.text).toBe('*b*');
      expect(result?.items[1]!.value?.wildcard).toBe(WildcardPositions.SURROUNDED);

      expect(result?.items[2]!.value?.value).toBe('c');
      expect(result?.items[2]!.value?.text).toBe('c');
      expect(result?.items[2]!.value?.wildcard).toBe(false);
    });

    it('quoted value', () => {
      const result = parseMultiSelectFilterValue('a,"*b*",c');

      expect(result).not.toBeNull();

      expect(result!.items).toHaveLength(3);
      expect(result?.items[0]!.value?.value).toBe('a');

      expect(result?.items[1]!.value?.value).toBe('*b*');
      expect(result?.items[1]!.value?.text).toBe('"*b*"');
      expect(result?.items[1]!.value?.quoted).toBe(true);
      expect(result?.items[1]!.value?.wildcard).toBe(WildcardPositions.SURROUNDED);

      expect(result!.items[2]!.value?.value).toBe('c');
    });

    it('spaces', () => {
      const result = parseMultiSelectFilterValue('a,*b c*,d');

      expect(result).not.toBeNull();

      expect(result!.items).toHaveLength(3);

      expect(result?.items[0]!.value?.value).toBe('a');
      expect(result?.items[1]!.value?.value).toBe('*b c*');
      expect(result?.items[1]!.value?.text).toBe('*b c*');
      expect(result?.items[1]!.value?.wildcard).toBe(WildcardPositions.SURROUNDED);

      expect(result?.items[2]!.value?.value).toBe('d');
    });
  });

  describe('trailing wildcard', () => {
    it('single value', () => {
      const result = parseMultiSelectFilterValue('a*');

      expect(result).not.toBeNull();
      expect(result!.items).toHaveLength(1);
      expect(result!.items[0]!.value?.value).toBe('a*');
      expect(result!.items[0]!.value?.text).toBe('a*');
      expect(result!.items[0]!.value?.wildcard).toBe(WildcardPositions.TRAILING);
    });

    it('multiple value', () => {
      const result = parseMultiSelectFilterValue('a*,b*,c');

      expect(result).not.toBeNull();

      expect(result!.items).toHaveLength(3);
      expect(result?.items[0]!.value?.value).toBe('a*');
      expect(result?.items[0]!.value?.text).toBe('a*');
      expect(result?.items[0]!.value?.wildcard).toBe(WildcardPositions.TRAILING);

      expect(result?.items[1]!.value?.value).toBe('b*');
      expect(result?.items[1]!.value?.text).toBe('b*');
      expect(result?.items[1]!.value?.wildcard).toBe(WildcardPositions.TRAILING);

      expect(result?.items[2]!.value?.value).toBe('c');
      expect(result?.items[2]!.value?.text).toBe('c');
      expect(result?.items[2]!.value?.wildcard).toBe(false);
    });

    it('quoted value', () => {
      const result = parseMultiSelectFilterValue('a,"b*",c');

      expect(result).not.toBeNull();

      expect(result!.items).toHaveLength(3);
      expect(result?.items[0]!.value?.value).toBe('a');

      expect(result?.items[1]!.value?.value).toBe('b*');
      expect(result?.items[1]!.value?.text).toBe('"b*"');
      expect(result?.items[1]!.value?.quoted).toBe(true);
      expect(result?.items[1]!.value?.wildcard).toBe(WildcardPositions.TRAILING);

      expect(result!.items[2]!.value?.value).toBe('c');
    });

    it('spaces', () => {
      const result = parseMultiSelectFilterValue('a,b c*,d');

      expect(result).not.toBeNull();

      expect(result!.items).toHaveLength(3);

      expect(result?.items[0]!.value?.value).toBe('a');
      expect(result?.items[1]!.value?.value).toBe('b c*');
      expect(result?.items[1]!.value?.text).toBe('b c*');
      expect(result?.items[1]!.value?.wildcard).toBe(WildcardPositions.TRAILING);

      expect(result?.items[2]!.value?.value).toBe('d');
    });
  });

  describe('leading wildcard', () => {
    it('single value', () => {
      const result = parseMultiSelectFilterValue('*a');

      expect(result).not.toBeNull();
      expect(result!.items).toHaveLength(1);
      expect(result!.items[0]!.value?.value).toBe('*a');
      expect(result!.items[0]!.value?.text).toBe('*a');
      expect(result!.items[0]!.value?.wildcard).toBe(WildcardPositions.LEADING);
    });

    it('multiple value', () => {
      const result = parseMultiSelectFilterValue('*a,*b,c');

      expect(result).not.toBeNull();

      expect(result!.items).toHaveLength(3);
      expect(result?.items[0]!.value?.value).toBe('*a');
      expect(result?.items[0]!.value?.text).toBe('*a');
      expect(result?.items[0]!.value?.wildcard).toBe(WildcardPositions.LEADING);

      expect(result?.items[1]!.value?.value).toBe('*b');
      expect(result?.items[1]!.value?.text).toBe('*b');
      expect(result?.items[1]!.value?.wildcard).toBe(WildcardPositions.LEADING);

      expect(result?.items[2]!.value?.value).toBe('c');
      expect(result?.items[2]!.value?.text).toBe('c');
      expect(result?.items[2]!.value?.wildcard).toBe(false);
    });

    it('quoted value', () => {
      const result = parseMultiSelectFilterValue('a,"*b",c');

      expect(result).not.toBeNull();

      expect(result!.items).toHaveLength(3);
      expect(result?.items[0]!.value?.value).toBe('a');

      expect(result?.items[1]!.value?.value).toBe('*b');
      expect(result?.items[1]!.value?.text).toBe('"*b"');
      expect(result?.items[1]!.value?.quoted).toBe(true);
      expect(result?.items[1]!.value?.wildcard).toBe(WildcardPositions.LEADING);

      expect(result!.items[2]!.value?.value).toBe('c');
    });

    it('spaces', () => {
      const result = parseMultiSelectFilterValue('a,*b c,d');

      expect(result).not.toBeNull();

      expect(result!.items).toHaveLength(3);

      expect(result?.items[0]!.value?.value).toBe('a');
      expect(result?.items[1]!.value?.value).toBe('*b c');
      expect(result?.items[1]!.value?.text).toBe('*b c');
      expect(result?.items[1]!.value?.wildcard).toBe(WildcardPositions.LEADING);

      expect(result?.items[2]!.value?.value).toBe('d');
    });
  });
});
