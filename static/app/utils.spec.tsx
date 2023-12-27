import {omit} from './utils';

describe('omit', () => {
  // Omit and omit fn signatures are the same, so we can test them together
  // and they should be compatible for shallow objects.
  it('throws on non-object', () => {
    for (const v of [1, 'a', true, false, NaN, undefined, null, [], () => {}]) {
      try {
        omit(v as object, 'a');
        // This has to be unreachable
        // eslint-disable-next-line
        console.log('Should not be here for value', JSON.stringify(v));
        throw new Error("Shouldn't be here for value" + JSON.stringify(v));
      } catch (e) {
        expect(e instanceof TypeError).toBe(true);
        expect(e.message.startsWith('Omit expected object-like input value')).toBe(true);
      }
    }
  });
  it('does nothing if key does not exist', () => {
    const obj = {a: 1, ab: 2};

    expect(omit(obj, 'b')).toEqual(obj);
    expect(omit(obj, 'b')).not.toBe(obj);
  });
  it('omits a key', () => {
    expect(omit({a: 1, b: 2}, 'a')).toEqual({b: 2});
  });
  it('omits keys', () => {
    expect(omit({a: 1, b: 2, c: 3}, ['a', 'c'])).toEqual({b: 2});
  });
  it('omits nested keys', () => {
    expect(omit({a: {b: {c: 3}}}, 'a.b.c')).toEqual({a: {b: {}}});
  });
  it('omits shallow key if it is a property', () => {
    expect(omit({a: 1, 'a.b.c': 2}, 'a.b.c')).toEqual({a: 1});
  });
  it('omits both shallow and deep key if they are valid properties', () => {
    // c is a shallow key, a.b.c is a deep key, both are valid properties and should be removed
    expect(omit({a: {b: {c: 2}}, 'a.b.c': 2, d: 1}, 'a.b.c')).toEqual({a: {b: {}}, d: 1});
  });
  it('does not omit on partial path hit', () => {
    expect(omit({a: {b: {c: 3}}}, 'a.b.d')).toEqual({a: {b: {c: 3}}});
  });
  it('fallbacks to cloneDeep if source is not cloneable', () => {
    const v = {a: 1, b: () => {}};
    expect(omit(v, 'a')).toEqual({b: v.b});
  });
  it('does not mutate argument value', () => {
    const v = {a: {b: 1, c: 2}};
    expect(omit(v, 'a.b')).toEqual({a: {c: 2}});
    expect(v).toEqual({a: {b: 1, c: 2}});
  });
});
