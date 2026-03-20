import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {parseSearch} from 'sentry/components/searchSyntax/parser';

import {useAsyncFilterKeyValidation} from './useAsyncFilterKeyValidation';

describe('useAsyncFilterKeyValidation', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns empty warnings when validateFilterKeys is not provided', () => {
    const {result} = renderHookWithProviders(() =>
      useAsyncFilterKeyValidation(null, undefined)
    );
    expect(result.current).toEqual({});
  });

  it('returns warnings for invalid keys', async () => {
    const validateFilterKeys = jest
      .fn()
      .mockResolvedValue({'bad-key': 'Key does not exist'});

    const {result} = renderHookWithProviders(() =>
      useAsyncFilterKeyValidation(parseSearch('bad-key:foo'), validateFilterKeys)
    );

    act(() => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(result.current['bad-key']).toBe('Key does not exist');
    });

    expect(validateFilterKeys).toHaveBeenCalledWith(['bad-key']);
  });

  it('discards stale responses', async () => {
    let resolveFirst!: (value: Record<string, string>) => void;
    let resolveSecond!: (value: Record<string, string>) => void;

    const firstPromise = new Promise<Record<string, string>>(resolve => {
      resolveFirst = resolve;
    });
    const secondPromise = new Promise<Record<string, string>>(resolve => {
      resolveSecond = resolve;
    });

    const validateFilterKeys = jest
      .fn()
      .mockReturnValueOnce(firstPromise)
      .mockReturnValueOnce(secondPromise);

    const {result, rerender} = renderHookWithProviders(
      ({query}: {query: string}) =>
        useAsyncFilterKeyValidation(parseSearch(query), validateFilterKeys),
      {initialProps: {query: 'first-key:foo'}}
    );

    act(() => {
      jest.advanceTimersByTime(300);
    });

    rerender({query: 'second-key:bar'});

    act(() => {
      jest.advanceTimersByTime(300);
    });

    // Resolve second first, then first
    act(() => {
      resolveSecond({'second-key': 'second warning'});
    });

    await waitFor(() => {
      expect(result.current['second-key']).toBe('second warning');
    });

    // Now resolve first (stale) — should not overwrite
    act(() => {
      resolveFirst({'first-key': 'stale warning'});
    });

    expect(result.current['first-key']).toBeUndefined();
    expect(result.current['second-key']).toBe('second warning');
  });

  it('does not call setState after unmount', () => {
    const consoleSpy = jest.spyOn(console, 'error');

    let resolveRequest!: (value: Record<string, string>) => void;
    const pendingPromise = new Promise<Record<string, string>>(resolve => {
      resolveRequest = resolve;
    });

    const validateFilterKeys = jest.fn().mockReturnValue(pendingPromise);

    const {unmount} = renderHookWithProviders(() =>
      useAsyncFilterKeyValidation(parseSearch('some-key:foo'), validateFilterKeys)
    );

    act(() => {
      jest.advanceTimersByTime(300);
    });

    unmount();

    act(() => {
      resolveRequest({'some-key': 'a warning'});
    });

    expect(consoleSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('unmounted'),
      expect.anything()
    );

    consoleSpy.mockRestore();
  });

  it('clears warnings when all filter keys are removed', async () => {
    const validateFilterKeys = jest
      .fn()
      .mockResolvedValue({'some-key': 'Key does not exist'});

    const {result, rerender} = renderHookWithProviders(
      ({query}: {query: string | null}) =>
        useAsyncFilterKeyValidation(
          query ? parseSearch(query) : null,
          validateFilterKeys
        ),
      {initialProps: {query: 'some-key:foo' as string | null}}
    );

    act(() => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(result.current['some-key']).toBe('Key does not exist');
    });

    rerender({query: null});

    act(() => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(result.current).toEqual({});
    });
  });
});
