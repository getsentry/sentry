import {reactHooks} from 'sentry-test/reactTestingLibrary';

import {useVirtualizedTree} from './useVirtualizedTree';
import {VirtualizedTree} from './VirtualizedTree';

describe('useVirtualizedTree', () => {
  it('returns a tree', () => {
    const results = reactHooks.renderHook(() =>
      useVirtualizedTree({overscroll: 0, roots: []})
    );

    expect(results.result.current.tree).toBeInstanceOf(VirtualizedTree);
    expect(results.result.current.items).toEqual([]);
  });
});
