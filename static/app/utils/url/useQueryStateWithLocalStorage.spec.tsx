import {parseAsBoolean, parseAsInteger, parseAsString} from 'nuqs';
import {withNuqsTestingAdapter} from 'nuqs/adapters/testing';

import {act, renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import localStorageWrapper from 'sentry/utils/localStorage';
import {useQueryStateWithLocalStorage} from 'sentry/utils/url/useQueryStateWithLocalStorage';

describe('useQueryStateWithLocalStorage', () => {
  beforeEach(() => {
    localStorageWrapper.clear();
  });

  it('returns default value when neither URL nor localStorage has value', () => {
    const {result} = renderHook(
      () =>
        useQueryStateWithLocalStorage(
          'testParam',
          'testNamespace:testParam',
          parseAsString,
          'fallback'
        ),
      {
        wrapper: withNuqsTestingAdapter(),
      }
    );

    expect(result.current[0]).toBe('fallback');
  });

  it('returns localStorage value when URL is empty', () => {
    localStorageWrapper.setItem('testNamespace:testParam', 'fromStorage');

    const {result} = renderHook(
      () =>
        useQueryStateWithLocalStorage(
          'testParam',
          'testNamespace:testParam',
          parseAsString,
          'notUsed'
        ),
      {
        wrapper: withNuqsTestingAdapter(),
      }
    );

    expect(result.current[0]).toBe('fromStorage');
  });

  it('returns URL value when URL has value (URL takes precedence)', () => {
    localStorageWrapper.setItem('testNamespace:testParam', 'fromStorage');

    const {result} = renderHook(
      () =>
        useQueryStateWithLocalStorage(
          'testParam',
          'testNamespace:testParam',
          parseAsString,
          'unused'
        ),
      {
        wrapper: withNuqsTestingAdapter({
          searchParams: {testParam: 'fromURL'},
        }),
      }
    );

    expect(result.current[0]).toBe('fromURL');
  });

  it('syncs localStorage when URL changes', async () => {
    renderHook(
      () =>
        useQueryStateWithLocalStorage(
          'testParam',
          'testNamespace:testParam',
          parseAsString,
          'initial'
        ),
      {
        wrapper: withNuqsTestingAdapter({
          searchParams: {testParam: 'newURLValue'},
        }),
      }
    );

    await waitFor(() => {
      const storedValue = localStorageWrapper.getItem('testNamespace:testParam');
      expect(storedValue).toBe('newURLValue');
    });
  });

  it('setValue updates both URL and localStorage', async () => {
    const onUrlUpdate = jest.fn();

    const {result} = renderHook(
      () =>
        useQueryStateWithLocalStorage(
          'testParam',
          'testNamespace:testParam',
          parseAsString,
          'starting'
        ),
      {
        wrapper: withNuqsTestingAdapter({onUrlUpdate}),
      }
    );

    act(() => {
      result.current[1]('newValue');
    });

    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          queryString: expect.stringContaining('testParam=newValue'),
        })
      );
    });

    await waitFor(() => {
      const storedValue = localStorageWrapper.getItem('testNamespace:testParam');
      expect(storedValue).toBe('newValue');
    });
  });

  it('works with enum-like string types', async () => {
    localStorageWrapper.setItem('myNamespace:sort', 'name');

    const onUrlUpdate = jest.fn();

    const {result} = renderHook(
      () =>
        useQueryStateWithLocalStorage('sort', 'myNamespace:sort', parseAsString, 'date'),
      {
        wrapper: withNuqsTestingAdapter({onUrlUpdate}),
      }
    );

    expect(result.current[0]).toBe('name');

    act(() => {
      result.current[1]('size');
    });

    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          queryString: expect.stringContaining('sort=size'),
        })
      );
    });

    await waitFor(() => {
      const storedValue = localStorageWrapper.getItem('myNamespace:sort');
      expect(storedValue).toBe('size');
    });
  });

  it('does not sync localStorage if URL value matches localStorage', () => {
    localStorageWrapper.setItem('testNamespace:testParam', 'sameValue');

    const {result} = renderHook(
      () =>
        useQueryStateWithLocalStorage(
          'testParam',
          'testNamespace:testParam',
          parseAsString,
          'baseline'
        ),
      {
        wrapper: withNuqsTestingAdapter({
          searchParams: {testParam: 'sameValue'},
        }),
      }
    );

    expect(result.current[0]).toBe('sameValue');

    const storedValue = localStorageWrapper.getItem('testNamespace:testParam');
    expect(storedValue).toBe('sameValue');
  });

  it('works with integer values using parseAsInteger', async () => {
    localStorageWrapper.setItem('testNamespace:count', '42');

    const onUrlUpdate = jest.fn();

    const {result} = renderHook(
      () =>
        useQueryStateWithLocalStorage(
          'count',
          'testNamespace:count',
          parseAsInteger,
          999
        ),
      {
        wrapper: withNuqsTestingAdapter({onUrlUpdate}),
      }
    );

    expect(result.current[0]).toBe(42);
    expect(typeof result.current[0]).toBe('number');

    act(() => {
      result.current[1](100);
    });

    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          queryString: expect.stringContaining('count=100'),
        })
      );
    });

    await waitFor(() => {
      const storedValue = localStorageWrapper.getItem('testNamespace:count');
      expect(storedValue).toBe('100');
    });
  });

  it('works with boolean values using parseAsBoolean', async () => {
    localStorageWrapper.setItem('testNamespace:enabled', 'true');

    const onUrlUpdate = jest.fn();

    const {result} = renderHook(
      () =>
        useQueryStateWithLocalStorage(
          'enabled',
          'testNamespace:enabled',
          parseAsBoolean,
          false
        ),
      {
        wrapper: withNuqsTestingAdapter({onUrlUpdate}),
      }
    );

    expect(result.current[0]).toBe(true);
    expect(typeof result.current[0]).toBe('boolean');

    act(() => {
      result.current[1](false);
    });

    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          queryString: expect.stringContaining('enabled=false'),
        })
      );
    });

    await waitFor(() => {
      const storedValue = localStorageWrapper.getItem('testNamespace:enabled');
      expect(storedValue).toBe('false');
    });
  });

  it('URL integer value overrides localStorage', () => {
    localStorageWrapper.setItem('testNamespace:pageSize', '25');

    const {result} = renderHook(
      () =>
        useQueryStateWithLocalStorage(
          'pageSize',
          'testNamespace:pageSize',
          parseAsInteger,
          5
        ),
      {
        wrapper: withNuqsTestingAdapter({
          searchParams: {pageSize: '50'},
        }),
      }
    );

    expect(result.current[0]).toBe(50);
  });

  it('throws error when parser has .withDefault() configured', () => {
    expect(() => {
      renderHook(
        () =>
          useQueryStateWithLocalStorage(
            'testParam',
            'testNamespace:testParam',
            parseAsString.withDefault('shouldThrow'),
            'ignored'
          ),
        {
          wrapper: withNuqsTestingAdapter(),
        }
      );
    }).toThrow(
      'useQueryStateWithLocalStorage: parser should not have .withDefault() configured'
    );
  });
});
