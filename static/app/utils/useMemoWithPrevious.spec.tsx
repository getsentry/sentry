import {renderHook} from 'sentry-test/reactTestingLibrary';

import {useMemoWithPrevious} from 'sentry/utils/useMemoWithPrevious';

describe('useMemoWithPrevious', () => {
  it('calls factory with null', () => {
    const deps = [{}];

    const factory = jest.fn().mockImplementation(() => 'foo');

    const {result} = renderHook(useMemoWithPrevious, {initialProps: {factory, deps}});
    expect(factory).toHaveBeenCalledWith(null);
    expect(result.current).toBe('foo');
  });

  it('calls factory with previous value', () => {
    const factory = jest.fn().mockReturnValueOnce('foo').mockReturnValueOnce('bar');

    // New reference will trigger a rerender
    const firstDependency: unknown[] = [];
    const secondDependency: unknown[] = [];

    const {rerender, result} = renderHook(useMemoWithPrevious, {
      initialProps: {
        factory,
        deps: [firstDependency],
      },
    });

    rerender({factory, deps: [secondDependency]});

    expect(result.current).toBe('bar');
    expect(factory.mock.calls[1][0]).toBe('foo');

    expect(factory).toHaveBeenCalledTimes(2);
  });
});
