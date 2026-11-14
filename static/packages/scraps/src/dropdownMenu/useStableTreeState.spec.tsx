import {Item} from '@react-stately/collections';
import {act, renderHook} from '@testing-library/react';

import type {MenuItemProps} from './item';
import {useStableTreeState} from './useStableTreeState';

const items: MenuItemProps[] = [
  {key: 'one', label: 'One'},
  {key: 'two', label: 'Two'},
];
// A stable render function, like the one the React Compiler memoizes in
// `DropdownMenuContent`. A new function would rebuild the collection.
const renderItem = (item: MenuItemProps) => <Item key={item.key}>{item.label}</Item>;

type HookProps = Partial<Parameters<typeof useStableTreeState>[0]>;

function renderTreeState(props: HookProps = {}) {
  return renderHook(
    (hookProps: HookProps) =>
      useStableTreeState({
        items,
        children: renderItem,
        selectionMode: 'single',
        ...hookProps,
      }),
    {initialProps: props}
  );
}

describe('useStableTreeState', () => {
  it('keeps its identity when re-rendered without changes', () => {
    const {result, rerender} = renderTreeState();
    const initial = result.current;

    rerender({});

    expect(result.current).toBe(initial);
  });

  it('returns a new state when focus moves', () => {
    const {result} = renderTreeState();
    const initial = result.current;

    act(() => result.current.selectionManager.setFocusedKey('two'));

    expect(result.current).not.toBe(initial);
    expect(result.current.selectionManager.focusedKey).toBe('two');
  });

  it('returns a new state when the selection changes', () => {
    const {result} = renderTreeState();
    const initial = result.current;

    act(() => result.current.selectionManager.replaceSelection('one'));

    expect(result.current).not.toBe(initial);
    expect(result.current.selectionManager.isSelected('one')).toBe(true);
  });

  it('returns a new state when the items change', () => {
    const {result, rerender} = renderTreeState();
    const initial = result.current;

    rerender({items: [...items, {key: 'three', label: 'Three'}]});

    expect(result.current).not.toBe(initial);
    expect(result.current.collection.getItem('three')).not.toBeNull();
  });

  it('returns a new state when the disabled keys change', () => {
    const {result, rerender} = renderTreeState();
    const initial = result.current;

    rerender({disabledKeys: ['two']});

    expect(result.current).not.toBe(initial);
    expect(result.current.disabledKeys.has('two')).toBe(true);
  });

  // Rows that kept an old state would call the callbacks it was built with.
  it.each(['onAction', 'onSelectionChange', 'onExpandedChange'] as const)(
    'returns a new state when %s changes',
    callback => {
      const {result, rerender} = renderTreeState({[callback]: jest.fn()});
      const initial = result.current;

      rerender({[callback]: jest.fn()});

      expect(result.current).not.toBe(initial);
    }
  );
});
