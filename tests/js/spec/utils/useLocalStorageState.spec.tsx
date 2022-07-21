import {reactHooks} from 'sentry-test/reactTestingLibrary';

import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';

describe('useLocalStorageState', () => {
  beforeEach(() => {
    global.localStorage.clear();

    if (global.localStorage.length > 0) {
      throw new Error('localStorage was not cleared');
    }
  });

  it('throws if key is not a string', () => {
    const results = reactHooks.renderHook(() =>
      // @ts-expect-error force incorrect usage
      useLocalStorageState({}, 'default value')
    );
    expect(results.result.error).toBeInstanceOf(TypeError);
    expect(results.result.error?.message).toBe('useLocalStorage: key must be a string');
  });

  it('initialized with value', () => {
    const {result} = reactHooks.renderHook(() =>
      useLocalStorageState('key', 'default value')
    );
    expect(result.current[0]).toBe('default value');
  });

  it('initializes with init fn', () => {
    const initialize = jest.fn(() => 'default value');
    const {result} = reactHooks.renderHook(() => useLocalStorageState('key', initialize));

    expect(initialize).toHaveBeenCalled();
    expect(result.current[0]).toBe('default value');
  });

  it('sets new value', () => {
    const {result} = reactHooks.renderHook(() =>
      useLocalStorageState('key', 'default value')
    );

    reactHooks.act(() => {
      result.current[1]('new value');
    });

    expect(result.current[0]).toBe('new value');
  });

  it('updates localstorage value', async () => {
    const {result} = reactHooks.renderHook(() =>
      useLocalStorageState('key', 'default value')
    );
    const spy = jest.spyOn(Storage.prototype, 'setItem');

    reactHooks.act(() => {
      result.current[1]('new value');
    });

    // Exhaust task queue because setItem is scheduled as microtask
    await tick();
    expect(spy).toHaveBeenCalledWith('key', JSON.stringify('new value'));
  });

  it('when no value is present in storage, calls init with undefined and null', () => {
    const initialize = jest.fn(() => 'default value');

    reactHooks.renderHook(() => useLocalStorageState('key', initialize));
    expect(initialize).toHaveBeenCalledWith(undefined, null);
  });

  it('when a value is present but cannot be parsed, calls init with undefined, null', () => {
    global.localStorage.setItem('key', JSON.stringify('invalid').slice(0, 5));
    const initialize = jest.fn(() => 'default value');

    reactHooks.renderHook(() => useLocalStorageState('key', initialize));
    expect(initialize).toHaveBeenCalledWith(
      undefined,
      JSON.stringify('invalid json').slice(0, 5)
    );
  });

  it('when a value is present but cannot be parsed init can recover', () => {
    global.localStorage.setItem('key', JSON.stringify('invalid').slice(5, 9));
    const initialize = jest.fn((_decodedValue, encodedValue) => {
      const value = JSON.parse('"va' + encodedValue);
      return value;
    });

    const {result} = reactHooks.renderHook(() => useLocalStorageState('key', initialize));
    expect(result.current[0]).toBe('valid');
  });

  it('when a value is present, init can transform it', () => {
    global.localStorage.setItem('key', JSON.stringify('valid json'));
    const initialize = jest.fn((decodedValue, _encodedValue) => {
      return 'super ' + decodedValue;
    });

    const {result} = reactHooks.renderHook(() => useLocalStorageState('key', initialize));
    expect(result.current[0]).toBe('super valid json');
  });

  it('when a value is present and can be parsed, calls init with decoded and encoded value', () => {
    global.localStorage.setItem('key', JSON.stringify('valid json'));
    const initialize = jest.fn(() => 'default value');

    reactHooks.renderHook(() => useLocalStorageState('key', initialize));
    expect(initialize).toHaveBeenCalledWith('valid json', JSON.stringify('valid json'));
  });

  it.each([
    ['BigInt', BigInt(1)],
    ['RegExp (literal)', /regex/],
    ['RegExp (constructor)', new RegExp('regex')],
    ['Map', new Map()],
    ['Set', new Set()],
    ['WeakSet', new WeakSet()],
    ['WeakMap', new WeakMap()],
    // When invalid values are nested
    ['Map', {nested: new Map()}],
    ['Set', {nested: new Set()}],
    ['WeakSet', {nested: new WeakSet()}],
    ['WeakMap', {nested: new WeakMap()}],
  ])('when attempting to serialize a %s', (type, value) => {
    const results = reactHooks.renderHook(() => useLocalStorageState('key', value));
    // Immediately execute microtask so that the error is not thrown from the current execution stack and can be caught by a try/catch
    jest.spyOn(global.window, 'queueMicrotask').mockImplementation(cb => cb());

    try {
      results.result.current[1](value);
    } catch (e) {
      expect(
        e.message.startsWith(
          `useLocalStorage: Native serialization of ${
            type.split(' ')[0]
          } is not supported`
        )
      ).toBe(true);
    }
  });
});
