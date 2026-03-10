import {renderHook} from 'sentry-test/reactTestingLibrary';

import {useMemoTryCatch} from 'sentry/utils/useMemoTryCatch';

describe('useMemoTryCatch', () => {
  it('returns [value] when compute succeeds', () => {
    const compute = jest.fn().mockReturnValue(42);

    const {result} = renderHook(() => useMemoTryCatch(compute, 'x'));

    expect(result.current).toEqual([42]);
    expect(compute).toHaveBeenCalledWith('x');
  });

  it('returns [undefined, error] when compute throws', () => {
    const err = new Error('fail');
    const compute = jest.fn().mockImplementation(() => {
      throw err;
    });

    const {result} = renderHook(() => useMemoTryCatch(compute, 'x'));

    expect(result.current).toEqual([undefined, err]);
    expect(compute).toHaveBeenCalledWith('x');
  });

  it('does not recompute when arg and compute are unchanged', () => {
    const arg = {};
    const compute = jest.fn().mockReturnValue(1);

    const {result, rerender} = renderHook(() => useMemoTryCatch(compute, arg));

    expect(result.current).toEqual([1]);
    expect(compute.mock.calls).toEqual([[arg]]);

    rerender();
    rerender();

    expect(result.current).toEqual([1]);
    expect(compute.mock.calls).toEqual([[arg]]);
  });

  it('recomputes when arg changes', () => {
    const compute = jest.fn().mockImplementation((x: number) => x * 2);

    const {result, rerender} = renderHook(
      ({computeFn, arg}) => useMemoTryCatch(computeFn, arg),
      {
        initialProps: {
          computeFn: compute,
          arg: 1,
        },
      }
    );

    expect(result.current).toEqual([2]);
    expect(compute.mock.calls).toEqual([[1]]);

    rerender({computeFn: compute, arg: 2});

    expect(result.current).toEqual([4]);
    expect(compute.mock.calls).toEqual([[1], [2]]);
  });

  it('recomputes when compute reference changes', () => {
    const firstCompute = jest.fn().mockReturnValue('a');
    const secondCompute = jest.fn().mockReturnValue('b');
    const arg = 1;

    const {result, rerender} = renderHook(
      ({computeFn, a}) => useMemoTryCatch(computeFn, a),
      {
        initialProps: {
          computeFn: firstCompute,
          a: arg,
        },
      }
    );

    expect(result.current).toEqual(['a']);
    expect(firstCompute.mock.calls).toEqual([[arg]]);

    rerender({computeFn: secondCompute, a: arg});

    expect(result.current).toEqual(['b']);
    expect(secondCompute.mock.calls).toEqual([[arg]]);
  });
});
