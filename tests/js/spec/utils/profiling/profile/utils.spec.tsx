import {
  memoizeByReference,
  memoizeVariadicByReference,
} from 'sentry/utils/profiling/profile/utils';

describe('memoizeByReference', () => {
  it('doesnt crash w/o args', () => {
    const spy = jest.fn().mockImplementation(() => 1);
    const fn = memoizeByReference(spy);

    // @ts-ignore this shouldnt happen, but just in case it somehow gets passed
    // in during runtime, we want to eval the function every time. The reason
    // for doing so is that we dont know if it is pure or not.
    expect(() => fn()).not.toThrow();
    // @ts-ignore this shouldnt happen, but in case it does
    expect(fn()).toBe(1);

    expect(spy).toHaveBeenCalledTimes(2);
  });
  it('memoizes when values match by reference', () => {
    const fn = jest.fn().mockImplementation(v => v);

    const val = Math.random();
    const memoized = memoizeByReference(fn);

    // @ts-ignore we discard result of first call
    const _discard = memoized(val);
    const result = memoized(val);

    expect(result).toEqual(val);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('re-evaluates when values do not match by reference', () => {
    const fn = jest.fn().mockImplementation(v => v);

    const memoized = memoizeByReference(fn);

    // @ts-ignore we discard result of first call
    const _discard = memoized(1);
    const result = memoized(2);

    expect(result).toEqual(2);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('memoizeVariadicByReference', () => {
  it('doesnt crash w/o args', () => {
    const spy = jest.fn().mockImplementation(() => 1);
    const fn = memoizeVariadicByReference(spy);

    // @ts-ignore this shouldnt happen, but just in case it somehow gets passed
    // in during runtime, we want to eval the function every time. The reason
    // for doing so is that we dont know if it is pure or not.
    expect(() => fn()).not.toThrow();
    // @ts-ignore this shouldnt happen, but in case it does
    expect(fn()).toBe(1);

    expect(spy).toHaveBeenCalledTimes(2);
  });
  it('memoizes when args match by reference', () => {
    const fn = jest.fn().mockImplementation((a, b) => a + b);

    const memoized = memoizeVariadicByReference(fn);
    const a = 1;
    const b = 2;

    // @ts-ignore we discard result of first call
    const _discard = memoized(a, b);
    const result = memoized(a, b);

    expect(result).toBe(3);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('re-evaluates when values do not match by reference', () => {
    const fn = jest.fn().mockImplementation((a, b) => a + b);

    const memoized = memoizeVariadicByReference(fn);
    const a = 1;
    const b = 2;
    const c = 1;

    // @ts-ignore we discard result of first call
    const _discard = memoized(a, b);
    const result = memoized(a, c);

    expect(result).toBe(2);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
