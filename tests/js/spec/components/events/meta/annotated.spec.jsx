import Annotated from 'app/components/events/meta/annotated';

describe('Annotated', () => {
  it('constructs', () => {
    let value = 'foo';
    let meta = {};
    let annotated = new Annotated(value, meta);
    expect(annotated.value).toBe(value);
    expect(annotated.meta).toBe(meta);
  });

  describe('containing object', () => {
    it('resolves an object field with meta', () => {
      let value = {foo: 'bar'};
      let meta = {foo: {'': {}}};

      let annotated = new Annotated(value, meta);
      let inner = annotated.get('foo');
      expect(inner.value).toBe('bar');
      expect(inner.meta).toBe(meta.foo);
    });

    it('resolves an object field without meta', () => {
      let value = {foo: 'bar'};
      let meta = {};

      let annotated = new Annotated(value, meta);
      let inner = annotated.get('foo');
      expect(inner.value).toBe('bar');
      expect(inner.meta).toBe(null);
    });

    it('resolves a missing object field with meta', () => {
      let value = {};
      let meta = {foo: {'': {}}};

      let annotated = new Annotated(value, meta);
      let inner = annotated.get('foo');
      expect(inner.value).toBe(undefined);
      expect(inner.meta).toBe(meta.foo);
    });

    it('resolves a missing object field without meta', () => {
      let value = {};
      let meta = {};

      let annotated = new Annotated(value, meta);
      let inner = annotated.get('foo');
      expect(inner.value).toBe(undefined);
      expect(inner.meta).toBe(null);
    });
  });

  describe('containing array', () => {
    it('resolves an array item with meta', () => {
      let value = ['foo'];
      let meta = {'0': {'': {}}};

      let annotated = new Annotated(value, meta);
      let inner = annotated.get(0);
      expect(inner.value).toBe('foo');
      expect(inner.meta).toBe(meta[0]);
    });

    it('resolves an array item without meta', () => {
      let value = ['foo'];
      let meta = {};

      let annotated = new Annotated(value, meta);
      let inner = annotated.get(0);
      expect(inner.value).toBe('foo');
      expect(inner.meta).toBe(null);
    });

    it('resolves a missing array item with meta', () => {
      let value = {};
      let meta = {'0': {'': {}}};

      let annotated = new Annotated(value, meta);
      let inner = annotated.get(0);
      expect(inner.value).toBe(undefined);
      expect(inner.meta).toBe(meta[0]);
    });

    it('resolves a missing array item without meta', () => {
      let value = {};
      let meta = {};

      let annotated = new Annotated(value, meta);
      let inner = annotated.get(0);
      expect(inner.value).toBe(undefined);
      expect(inner.meta).toBe(null);
    });
  });

  describe('containing primitive', () => {
    it('resolves empty for properties', () => {
      let annotated = new Annotated('foo', {foo: {'': {}}});
      let inner = annotated.get('length');
      expect(inner.value).toBe(undefined);
      expect(inner.meta).toBe(null);
    });

    it('resolves empty for missing properties', () => {
      let annotated = new Annotated('foo', {foo: {'': {}}});
      let inner = annotated.get('foo');
      expect(inner.value).toBe(undefined);
      expect(inner.meta).toBe(null);
    });
  });

  describe('annotated()', () => {
    it('rejects without meta', () => {
      let annotated = new Annotated('foo', null);
      expect(annotated.annotated()).toBe(false);
    });

    it('rejects without own meta record', () => {
      let annotated = new Annotated('foo', {foo: {'': {}}});
      expect(annotated.annotated()).toBe(false);
    });

    it('rejects with empty meta record', () => {
      let annotated = new Annotated('foo', {'': {}});
      expect(annotated.annotated()).toBe(false);
    });

    it('rejects with irrelevant meta data', () => {
      let annotated = new Annotated('foo', {'': {len: 42}});
      expect(annotated.annotated()).toBe(false);
    });

    it('rejects with idempotent meta data', () => {
      let meta = {
        len: 42,
        rem: [],
        err: [],
        chunks: [{text: 'foo'}],
      };

      let annotated = new Annotated('foo', {'': meta});
      expect(annotated.annotated()).toBe(false);
    });

    it('passes with remarks in meta data', () => {
      let meta = {
        rem: [{}],
      };

      let annotated = new Annotated('foo', {'': meta});
      expect(annotated.annotated()).toBe(true);
    });

    it('passes with errors in meta data', () => {
      let meta = {
        err: ['some error'],
      };

      let annotated = new Annotated('foo', {'': meta});
      expect(annotated.annotated()).toBe(true);
    });
  });
});
