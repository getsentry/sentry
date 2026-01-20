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
        useQueryStateWithLocalStorage({
          key: 'testParam',
          namespace: 'testNamespace',
          defaultValue: 'default',
        }),
      {
        wrapper: withNuqsTestingAdapter(),
      }
    );

    expect(result.current[0]).toBe('default');
  });

  it('returns localStorage value when URL is empty', () => {
    localStorageWrapper.setItem('testNamespace:testParam', JSON.stringify('fromStorage'));

    const {result} = renderHook(
      () =>
        useQueryStateWithLocalStorage({
          key: 'testParam',
          namespace: 'testNamespace',
          defaultValue: 'default',
        }),
      {
        wrapper: withNuqsTestingAdapter(),
      }
    );

    expect(result.current[0]).toBe('fromStorage');
  });

  it('returns URL value when URL has value (URL takes precedence)', () => {
    localStorageWrapper.setItem('testNamespace:testParam', JSON.stringify('fromStorage'));

    const {result} = renderHook(
      () =>
        useQueryStateWithLocalStorage({
          key: 'testParam',
          namespace: 'testNamespace',
          defaultValue: 'default',
          parser: parseAsString,
        }),
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
        useQueryStateWithLocalStorage({
          key: 'testParam',
          namespace: 'testNamespace',
          defaultValue: 'default',
          parser: parseAsString,
        }),
      {
        wrapper: withNuqsTestingAdapter({
          searchParams: {testParam: 'newURLValue'},
        }),
      }
    );

    await waitFor(() => {
      const storedValue = localStorageWrapper.getItem('testNamespace:testParam');
      expect(storedValue).toBe(JSON.stringify('newURLValue'));
    });
  });

  it('setValue updates both URL and localStorage', async () => {
    const onUrlUpdate = jest.fn();

    const {result} = renderHook(
      () =>
        useQueryStateWithLocalStorage({
          key: 'testParam',
          namespace: 'testNamespace',
          defaultValue: 'default',
          parser: parseAsString,
        }),
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
      expect(storedValue).toBe(JSON.stringify('newValue'));
    });
  });

  it('works with enum-like string types', async () => {
    type SortOption = 'date' | 'name' | 'size';

    localStorageWrapper.setItem('myNamespace:sort', JSON.stringify('name'));

    const onUrlUpdate = jest.fn();

    const {result} = renderHook(
      () =>
        useQueryStateWithLocalStorage<SortOption>({
          key: 'sort',
          namespace: 'myNamespace',
          defaultValue: 'date',
        }),
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
      expect(storedValue).toBe(JSON.stringify('size'));
    });
  });

  it('does not sync localStorage if URL value matches localStorage', () => {
    localStorageWrapper.setItem('testNamespace:testParam', JSON.stringify('sameValue'));

    const {result} = renderHook(
      () =>
        useQueryStateWithLocalStorage({
          key: 'testParam',
          namespace: 'testNamespace',
          defaultValue: 'default',
          parser: parseAsString,
        }),
      {
        wrapper: withNuqsTestingAdapter({
          searchParams: {testParam: 'sameValue'},
        }),
      }
    );

    expect(result.current[0]).toBe('sameValue');

    const storedValue = localStorageWrapper.getItem('testNamespace:testParam');
    expect(storedValue).toBe(JSON.stringify('sameValue'));
  });

  it('works with integer values using parseAsInteger', async () => {
    localStorageWrapper.setItem('testNamespace:count', JSON.stringify(42));

    const onUrlUpdate = jest.fn();

    const {result} = renderHook(
      () =>
        useQueryStateWithLocalStorage({
          key: 'count',
          namespace: 'testNamespace',
          defaultValue: 0,
          parser: parseAsInteger,
        }),
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
      expect(storedValue).toBe(JSON.stringify(100));
    });
  });

  it('works with boolean values using parseAsBoolean', async () => {
    localStorageWrapper.setItem('testNamespace:enabled', JSON.stringify(true));

    const onUrlUpdate = jest.fn();

    const {result} = renderHook(
      () =>
        useQueryStateWithLocalStorage({
          key: 'enabled',
          namespace: 'testNamespace',
          defaultValue: false,
          parser: parseAsBoolean,
        }),
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
      expect(storedValue).toBe(JSON.stringify(false));
    });
  });

  it('URL integer value overrides localStorage', () => {
    localStorageWrapper.setItem('testNamespace:pageSize', JSON.stringify(25));

    const {result} = renderHook(
      () =>
        useQueryStateWithLocalStorage({
          key: 'pageSize',
          namespace: 'testNamespace',
          defaultValue: 10,
          parser: parseAsInteger,
        }),
      {
        wrapper: withNuqsTestingAdapter({
          searchParams: {pageSize: '50'},
        }),
      }
    );

    expect(result.current[0]).toBe(50);
  });
});
