import {reactHooks} from 'sentry-test/reactTestingLibrary';

import {useMemoWithPrevious} from 'sentry/utils/useMemoWithPrevious';

describe('useMemoWithPrevious', () => {
  it('calls factory with null', () => {
    const dep = {};

    const factory = jest.fn().mockImplementation(() => 'foo');

    const {result} = reactHooks.renderHook(() => useMemoWithPrevious(factory, [dep]));
    expect(factory).toHaveBeenCalledWith(null);
    expect(result.current).toEqual('foo');
  });

  it('calls factory with previous value', () => {
    const factory = jest.fn().mockReturnValueOnce('foo').mockReturnValueOnce('bar');

    // New reference will trigger a rerender
    const firstDependency = [];
    const secondDependency = [];

    const {rerender, result} = reactHooks.renderHook(
      ({fact, dep}) => useMemoWithPrevious(fact, [dep]),
      {
        initialProps: {
          fact: factory,
          dep: firstDependency,
        },
      }
    );

    rerender({fact: factory, dep: secondDependency});

    expect(result.current).toBe('bar');
    expect(factory.mock.calls[1][0]).toBe('foo');

    expect(factory).toHaveBeenCalledTimes(2);
  });
});
