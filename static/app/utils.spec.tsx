import {omit, omitDeep} from './utils';

describe('omit', () => {
  // Omit and OmitDeep fn signatures are the same, so we can test them together
  // and they should be compatible for shallow objects.
  for (const fn of [omit, omitDeep]) {
    it('throws on non-object', () => {
      for (const v of [
        1,
        'a',
        true,
        NaN,
        undefined,
        null,
        [],
        () => {},
        // eslint-disable-next-line
        new String(''),
        // eslint-disable-next-line
        new Number(1),
        // eslint-disable-next-line
        new Function(),
        Symbol('a'),
      ]) {
        try {
          fn(v as any, 'a');
        } catch (e) {
          expect(e instanceof TypeError).toBe(true);
          expect(e.message.startsWith('Omit expected object-like input value')).toBe(
            true
          );
        }
      }
    });
    it('does nothing if key does not exist', () => {
      const obj = {a: 1};
      // @ts-expect-error b does not exist
      expect(omit(obj, 'b')).toEqual(obj);
      // @ts-expect-error b does not exist
      expect(omit(obj, 'b')).not.toBe(obj);
    });
    it('omits a key', () => {
      expect(omit({a: 1, b: 2}, 'a')).toEqual({b: 2});
    });
    it('omits keys', () => {
      expect(omit({a: 1, b: 2, c: 3}, ['a', 'c'])).toEqual({b: 2});
    });
    it('does not mutate argument value', () => {
      const v = {a: 1, b: 2};
      expect(omit(v, 'a')).toEqual({b: 2});
      expect(v).toEqual({a: 1, b: 2});
    });
  }
});

describe('omitDeep', () => {
  it('throws on non-object', () => {
    for (const v of [
      1,
      'a',
      true,
      NaN,
      undefined,
      null,
      () => {},
      // eslint-disable-next-line
      new String(''),
      // eslint-disable-next-line
      new Number(1),
      // eslint-disable-next-line
      new Function(),
      Symbol('a'),
    ]) {
      try {
        omitDeep(v as any, 'a');
      } catch (e) {
        expect(e instanceof TypeError).toBe(true);
        expect(e.message.startsWith('Omit expected object-like input value')).toBe(true);
      }
    }
  });

  it('does nothing if key does not exist', () => {
    const obj = {a: {b: 1}};
    expect(omitDeep(obj, 'a.c')).toEqual(obj);
    expect(omitDeep(obj, 'a.c')).not.toBe(obj);
  });

  it('omits a key', () => {
    expect(omitDeep({a: {b: 1, c: 2}}, 'a.b')).toEqual({a: {c: 2}});
  });

  it('omits keys', () => {
    expect(omitDeep({a: {b: 2, c: 3}}, ['a.b', 'a.c'])).toEqual({a: {}});
  });

  it('does not omit on partial path hit', () => {
    expect(omitDeep({a: {b: {c: 3}}}, 'a.b.d')).toEqual({a: {b: {c: 3}}});
  });

  it('does not mutate argument value', () => {
    const v = {a: {b: 1, c: 2}};
    expect(omitDeep(v, 'a.b')).toEqual({a: {c: 2}});
    expect(v).toEqual({a: {b: 1, c: 2}});
  });
});
