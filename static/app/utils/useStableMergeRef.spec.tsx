import {renderHook} from 'sentry-test/reactTestingLibrary';

import {useStableMergeRef} from './useStableMergeRef';

describe('useStableMergeRef', () => {
  it('keeps merged refs stable for stable inputs', () => {
    const stableRef = jest.fn();
    const childRef = jest.fn();
    const {result, rerender} = renderHook(() => useStableMergeRef(stableRef));

    const firstMergedRef = result.current(childRef);
    rerender();

    expect(result.current(childRef)).toBe(firstMergedRef);
  });

  it('returns the stable ref when there is no child ref', () => {
    const stableRef = jest.fn();
    const {result} = renderHook(() => useStableMergeRef(stableRef));

    expect(result.current(null)).toBe(stableRef);
    expect(result.current(undefined)).toBe(stableRef);
  });

  it('resets merged refs when the stable ref changes', () => {
    const firstStableRef = jest.fn();
    const secondStableRef = jest.fn();
    const childRef = jest.fn();
    const {result, rerender} = renderHook(
      ({stableRef}: {stableRef: React.Ref<HTMLDivElement>}) =>
        useStableMergeRef(stableRef),
      {initialProps: {stableRef: firstStableRef}}
    );

    const firstMergedRef = result.current(childRef);
    rerender({stableRef: secondStableRef});

    expect(result.current(childRef)).not.toBe(firstMergedRef);
  });
});
