import {act, renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import localStorageWrapper from 'sentry/utils/localStorage';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';

describe('useLocalStorageState', () => {
  beforeEach(() => {
    localStorageWrapper.clear();

    if (localStorageWrapper.length > 0) {
      throw new Error('localStorage was not cleared');
    }
  });

  it('throws if key is not a string', async () => {
    let errorResult!: TypeError;

    renderHook(() => {
      try {
        // @ts-expect-error force incorrect usage
        useLocalStorageState({}, 'default value');
      } catch (err) {
        errorResult = err;
      }
    });

    await waitFor(() => expect(errorResult).toBeInstanceOf(TypeError));
    expect(errorResult.message).toBe('useLocalStorage: key must be a string');
  });

  it('initialized with value', () => {
    const {result} = renderHook(
      (args: Parameters<typeof useLocalStorageState>) =>
        useLocalStorageState(args[0], args[1]),
      {initialProps: ['key', 'default value']}
    );
    expect(result.current[0]).toBe('default value');
  });

  it('initializes with init fn', () => {
    const initialize = jest.fn(() => 'default value');
    const {result} = renderHook(
      (args: Parameters<typeof useLocalStorageState>) =>
        useLocalStorageState(args[0], args[1]),
      {initialProps: ['key', initialize]}
    );

    expect(initialize).toHaveBeenCalled();
    expect(result.current[0]).toBe('default value');
  });

  it('initializes with default value', () => {
    localStorageWrapper.setItem('key', JSON.stringify('initial storage value'));

    const {result} = renderHook(
      (args: Parameters<typeof useLocalStorageState>) =>
        useLocalStorageState(args[0], args[1]),
      {initialProps: ['key', 'default value']}
    );

    expect(result.current[0]).toBe('initial storage value');
  });

  it('sets new value', () => {
    const {result} = renderHook(
      (args: Parameters<typeof useLocalStorageState>) =>
        useLocalStorageState(args[0], args[1]),
      {initialProps: ['key', 'default value']}
    );

    act(() => {
      result.current[1]('new value');
    });

    expect(result.current[0]).toBe('new value');
  });

  it('sets new value using previous state', () => {
    const {result} = renderHook(
      (args: Parameters<typeof useLocalStorageState>) =>
        useLocalStorageState(args[0], args[1]),
      {initialProps: ['key', 'default value']}
    );

    act(() => {
      result.current[1]((p: string) => `${p} + new value`);
    });

    expect(result.current[0]).toBe('default value + new value');
  });

  it('updates localstorage value', async () => {
    const {result} = renderHook(
      (args: Parameters<typeof useLocalStorageState>) =>
        useLocalStorageState(args[0], args[1]),
      {initialProps: ['key', 'default value']}
    );
    const spy = jest.spyOn(Storage.prototype, 'setItem');

    act(() => {
      result.current[1]('new value');
    });

    // Exhaust task queue because setItem is scheduled as microtask
    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith('key', JSON.stringify('new value'));
    });
  });

  it('updates localstorage value with function callback', async () => {
    const {result} = renderHook(
      (args: Parameters<typeof useLocalStorageState>) =>
        useLocalStorageState(args[0], args[1]),
      {initialProps: ['key', 'default value']}
    );
    const spy = jest.spyOn(Storage.prototype, 'setItem');

    act(() => {
      result.current[1]((p: string) => `${p} + new value`);
    });

    // Exhaust task queue because setItem is scheduled as microtask
    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith(
        'key',
        JSON.stringify('default value + new value')
      );
    });
  });

  it('when no value is present in storage, calls init with undefined and null', () => {
    const initialize = jest.fn(() => 'default value');

    renderHook(
      (args: Parameters<typeof useLocalStorageState>) =>
        useLocalStorageState(args[0], args[1]),
      {initialProps: ['key', initialize]}
    );
    expect(initialize).toHaveBeenCalledWith(undefined, null);
  });

  it('when a value is present but cannot be parsed, calls init with undefined, null', () => {
    localStorageWrapper.setItem('key', JSON.stringify('invalid').slice(0, 5));
    const initialize = jest.fn(() => 'default value');

    renderHook(
      (args: Parameters<typeof useLocalStorageState>) =>
        useLocalStorageState(args[0], args[1]),
      {initialProps: ['key', initialize]}
    );
    expect(initialize).toHaveBeenCalledWith(
      undefined,
      JSON.stringify('invalid json').slice(0, 5)
    );
  });

  it('when a value is present but cannot be parsed init can recover', () => {
    localStorageWrapper.setItem('key', JSON.stringify('invalid').slice(5, 9));
    const initialize = jest.fn((_decodedValue, encodedValue) => {
      const value = JSON.parse('"va' + encodedValue);
      return value;
    });

    const {result} = renderHook(
      (args: Parameters<typeof useLocalStorageState>) =>
        useLocalStorageState(args[0], args[1]),
      {initialProps: ['key', initialize]}
    );
    expect(result.current[0]).toBe('valid');
  });

  it('when a value is present, init can transform it', () => {
    localStorageWrapper.setItem('key', JSON.stringify('valid json'));
    const initialize = jest.fn((decodedValue, _encodedValue) => {
      return 'super ' + decodedValue;
    });

    const {result} = renderHook(
      (args: Parameters<typeof useLocalStorageState>) =>
        useLocalStorageState(args[0], args[1]),
      {initialProps: ['key', initialize]}
    );
    expect(result.current[0]).toBe('super valid json');
  });

  it('when a value is present and can be parsed, calls init with decoded and encoded value', () => {
    localStorageWrapper.setItem('key', JSON.stringify('valid json'));
    const initialize = jest.fn(() => 'default value');

    renderHook(
      (args: Parameters<typeof useLocalStorageState>) =>
        useLocalStorageState(args[0], args[1]),
      {initialProps: ['key', initialize]}
    );
    expect(initialize).toHaveBeenCalledWith('valid json', JSON.stringify('valid json'));
  });

  it('crashes with TypeError for unsupported primitives when they are recursive', () => {
    const recursiveReferenceMap = new Map();
    recursiveReferenceMap.set('key', recursiveReferenceMap);

    jest.spyOn(window, 'queueMicrotask').mockImplementation(cb => cb());

    const {result} = renderHook(
      (args: Parameters<typeof useLocalStorageState>) =>
        useLocalStorageState(args[0], args[1]),
      {initialProps: ['key', recursiveReferenceMap]}
    );

    try {
      result.current[1](recursiveReferenceMap);
    } catch (e) {
      expect(
        e.message.startsWith(
          `useLocalStorage: Native serialization of Map is not supported`
        )
      ).toBe(true);
    }
  });

  it('crashes with native error on recursive serialization of plain objects', () => {
    const recursiveObject: Record<string, any> = {};
    recursiveObject.key = recursiveObject;

    jest.spyOn(window, 'queueMicrotask').mockImplementation(cb => cb());

    const {result} = renderHook(
      (args: Parameters<typeof useLocalStorageState>) =>
        useLocalStorageState(args[0], args[1]),
      {initialProps: ['key', recursiveObject]}
    );

    try {
      result.current[1](recursiveObject);
    } catch (e) {
      expect(e.message.startsWith('Converting circular structure to JSON')).toBe(true);
    }
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
    const {result} = renderHook(
      (args: Parameters<typeof useLocalStorageState>) =>
        useLocalStorageState(args[0], args[1]),
      {initialProps: ['key', value]}
    );

    // Immediately execute microtask so that the error is not thrown from the current execution stack and can be caught by a try/catch
    jest.spyOn(window, 'queueMicrotask').mockImplementation(cb => cb());

    try {
      result.current[1](value);
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
