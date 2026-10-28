import type * as React from 'react';
import {render, renderHook} from '@testing-library/react';

import {useStableMergeRef} from './useStableMergeRef';

describe('useStableMergeRef', () => {
  it('preserves callback ref cleanup without detaching on rerender', () => {
    const stableCleanup = jest.fn();
    const childCleanup = jest.fn();
    const stableRef = jest.fn(() => stableCleanup);
    const childRef = jest.fn(() => childCleanup);
    function Example() {
      const mergeRef = useStableMergeRef<HTMLDivElement>(stableRef);
      return <div ref={mergeRef(childRef)} />;
    }
    const {rerender, unmount} = render(<Example />);
    rerender(<Example />);
    expect(stableRef).toHaveBeenCalledTimes(1);
    expect(childRef).toHaveBeenCalledTimes(1);
    expect(stableCleanup).not.toHaveBeenCalled();
    expect(childCleanup).not.toHaveBeenCalled();
    unmount();
    expect(stableCleanup).toHaveBeenCalledTimes(1);
    expect(childCleanup).toHaveBeenCalledTimes(1);
  });

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
