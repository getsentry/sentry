import {
  createMultiParser,
  parseAsArrayOf,
  parseAsBoolean,
  parseAsInteger,
  parseAsString,
} from 'nuqs';
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

  it('handles empty string values correctly', () => {
    // Set empty string in localStorage
    localStorageWrapper.setItem('testNamespace:testParam', '');

    const {result} = renderHook(
      () =>
        useQueryStateWithLocalStorage(
          'testParam',
          'testNamespace:testParam',
          parseAsString,
          'defaultValue'
        ),
      {
        wrapper: withNuqsTestingAdapter(),
      }
    );

    // Empty string from localStorage should be returned, not the default
    expect(result.current[0]).toBe('');
  });

  it('syncs empty string URL values to localStorage', async () => {
    const {result} = renderHook(
      () =>
        useQueryStateWithLocalStorage(
          'testParam',
          'testNamespace:testParam',
          parseAsString,
          'defaultValue'
        ),
      {
        wrapper: withNuqsTestingAdapter({
          searchParams: {testParam: ''},
        }),
      }
    );

    expect(result.current[0]).toBe('');

    // Empty string from URL should be synced to localStorage
    await waitFor(() => {
      const storedValue = localStorageWrapper.getItem('testNamespace:testParam');
      expect(storedValue).toBe('');
    });
  });

  it('works with array values using parseAsArrayOf (SingleParser)', async () => {
    localStorageWrapper.setItem('testNamespace:tags', 'foo,bar,baz');

    const onUrlUpdate = jest.fn();

    const {result} = renderHook(
      () =>
        useQueryStateWithLocalStorage(
          'tags',
          'testNamespace:tags',
          parseAsArrayOf(parseAsString),
          []
        ),
      {
        wrapper: withNuqsTestingAdapter({onUrlUpdate}),
      }
    );

    // Should populate URL from localStorage on mount
    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          queryString: expect.stringContaining('tags=foo,bar,baz'),
        })
      );
    });

    // Value should be parsed as array
    expect(result.current[0]).toEqual(['foo', 'bar', 'baz']);

    act(() => {
      result.current[1](['new', 'tags']);
    });

    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          queryString: expect.stringContaining('tags=new,tags'),
        })
      );
    });

    await waitFor(() => {
      const storedValue = localStorageWrapper.getItem('testNamespace:tags');
      expect(storedValue).toBe('new,tags');
    });
  });

  it('works with native array values using MultiParser', async () => {
    // Create a custom MultiParser without .withDefault()
    // This mimics parseAsNativeArrayOf but without the automatic default
    const parseAsStringArray = createMultiParser<string[]>({
      parse: values => {
        const filtered = values.filter(v => v !== null);
        return filtered.length > 0 ? filtered : null;
      },
      serialize: values => values,
    });

    // Multi parser stores as JSON array in localStorage
    localStorageWrapper.setItem('testNamespace:tags', '["foo","bar","baz"]');

    const onUrlUpdate = jest.fn();

    const {result} = renderHook(
      () =>
        useQueryStateWithLocalStorage(
          'tags',
          'testNamespace:tags',
          parseAsStringArray,
          []
        ),
      {
        wrapper: withNuqsTestingAdapter({onUrlUpdate}),
      }
    );

    // Should populate URL from localStorage on mount
    await waitFor(() => {
      // Native array format uses repeated keys: ?tags=foo&tags=bar&tags=baz
      expect(onUrlUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          queryString: expect.stringMatching(/tags=foo.*tags=bar.*tags=baz/),
        })
      );
    });

    // Value should be parsed as array
    expect(result.current[0]).toEqual(['foo', 'bar', 'baz']);

    act(() => {
      result.current[1](['new', 'tags']);
    });

    await waitFor(() => {
      // Native array format: ?tags=new&tags=tags
      expect(onUrlUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          queryString: expect.stringMatching(/tags=new.*tags=tags/),
        })
      );
    });

    await waitFor(() => {
      const storedValue = localStorageWrapper.getItem('testNamespace:tags');
      // Should be stored as JSON array
      expect(JSON.parse(storedValue!)).toEqual(['new', 'tags']);
    });
  });

  it('setting value to null clears both URL and localStorage', async () => {
    localStorageWrapper.setItem('testNamespace:param', 'fromStorage');

    const onUrlUpdate = jest.fn();

    const {result} = renderHook(
      () =>
        useQueryStateWithLocalStorage(
          'param',
          'testNamespace:param',
          parseAsString,
          'defaultValue'
        ),
      {
        wrapper: withNuqsTestingAdapter({
          searchParams: {param: 'fromURL'},
          onUrlUpdate,
        }),
      }
    );

    expect(result.current[0]).toBe('fromURL');

    // Set to null
    act(() => {
      result.current[1](null);
    });

    await waitFor(() => {
      // Should fall back to default
      expect(result.current[0]).toBe('defaultValue');
    });

    // localStorage should be cleared
    expect(localStorageWrapper.getItem('testNamespace:param')).toBeNull();

    // URL should be cleared
    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          queryString: '',
        })
      );
    });
  });

  it('populates URL from localStorage on mount when URL is empty', async () => {
    localStorageWrapper.setItem('testNamespace:param', 'fromStorage');

    const onUrlUpdate = jest.fn();

    const {result} = renderHook(
      () =>
        useQueryStateWithLocalStorage(
          'param',
          'testNamespace:param',
          parseAsString,
          'defaultValue'
        ),
      {
        wrapper: withNuqsTestingAdapter({onUrlUpdate}),
      }
    );

    // Initially shows localStorage value (as it gets written to URL)
    await waitFor(() => {
      expect(result.current[0]).toBe('fromStorage');
    });

    // URL should be populated
    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          queryString: expect.stringContaining('param=fromStorage'),
        })
      );
    });
  });
});
