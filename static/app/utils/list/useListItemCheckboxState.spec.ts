import {act, renderHook} from 'sentry-test/reactTestingLibrary';

import {useListItemCheckboxContext} from 'sentry/utils/list/useListItemCheckboxState';
import type {ApiQueryKey} from 'sentry/utils/queryClient';

const queryKey: ApiQueryKey = ['test'];

describe('useListItemCheckboxContext', () => {
  describe('All hits are already known', () => {
    it('should return the correct initial state', () => {
      const {result} = renderHook(() =>
        useListItemCheckboxContext({hits: 3, knownIds: ['1', '2', '3'], queryKey})
      );
      expect(result.current).toEqual({
        countSelected: 0,
        deselectAll: expect.any(Function),
        hits: 3,
        isAllSelected: false,
        isAnySelected: false,
        isSelected: expect.any(Function),
        knownIds: ['1', '2', '3'],
        queryKey,
        selectAll: expect.any(Function),
        selectedIds: [],
        toggleSelected: expect.any(Function),
      });
    });

    it('should allow selecting an individual item when all hits are known', () => {
      const {result} = renderHook(() =>
        useListItemCheckboxContext({hits: 3, knownIds: ['1', '2', '3'], queryKey})
      );

      // Initially nothing is selected
      expect(result.current.isSelected('1')).toBe(false);
      expect(result.current.isSelected('2')).toBe(false);
      expect(result.current.isSelected('3')).toBe(false);
      expect(result.current.isAllSelected).toBe(false);
      expect(result.current.isAnySelected).toBe(false);
      expect(result.current.countSelected).toBe(0);

      // Select item '1'
      act(() => {
        result.current.toggleSelected('1');
      });

      // Check that only item '1' is selected
      expect(result.current.isSelected('1')).toBe(true);
      expect(result.current.isSelected('2')).toBe(false);
      expect(result.current.isSelected('3')).toBe(false);
      expect(result.current.isAllSelected).toBe('indeterminate');
      expect(result.current.isAnySelected).toBe(true);
      expect(result.current.countSelected).toBe(1);
      expect(result.current.selectedIds).toEqual(['1']);

      // Select item '2' as well
      act(() => {
        result.current.toggleSelected('2');
      });

      // Check that both items are selected
      expect(result.current.isSelected('1')).toBe(true);
      expect(result.current.isSelected('2')).toBe(true);
      expect(result.current.isSelected('3')).toBe(false);
      expect(result.current.isAllSelected).toBe('indeterminate');
      expect(result.current.isAnySelected).toBe(true);
      expect(result.current.countSelected).toBe(2);
      expect(result.current.selectedIds).toEqual(['1', '2']);

      // Deselect item '1'
      act(() => {
        result.current.toggleSelected('1');
      });

      // Check that only item '2' is selected
      expect(result.current.isSelected('1')).toBe(false);
      expect(result.current.isSelected('2')).toBe(true);
      expect(result.current.isSelected('3')).toBe(false);
      expect(result.current.isAllSelected).toBe('indeterminate');
      expect(result.current.isAnySelected).toBe(true);
      expect(result.current.countSelected).toBe(1);
      expect(result.current.selectedIds).toEqual(['2']);
    });

    it('sets isAllSelected to true when all items are selected', () => {
      const {result} = renderHook(() =>
        useListItemCheckboxContext({hits: 3, knownIds: ['1', '2', '3'], queryKey})
      );

      // Initially nothing is selected
      expect(result.current.isSelected('1')).toBe(false);
      expect(result.current.isSelected('2')).toBe(false);
      expect(result.current.isSelected('3')).toBe(false);
      expect(result.current.isAllSelected).toBe(false);

      act(() => {
        result.current.toggleSelected('1');
        result.current.toggleSelected('2');
        result.current.toggleSelected('3');
      });

      // Check that all items are selected
      expect(result.current.isSelected('1')).toBe(true);
      expect(result.current.isSelected('2')).toBe(true);
      expect(result.current.isSelected('3')).toBe(true);
      expect(result.current.isAllSelected).toBe(true);
    });

    it('should allow selecting all items with selectAll', () => {
      const {result} = renderHook(() =>
        useListItemCheckboxContext({hits: 3, knownIds: ['1', '2', '3'], queryKey})
      );

      // Initially nothing is selected
      expect(result.current.isSelected('1')).toBe(false);
      expect(result.current.isSelected('2')).toBe(false);
      expect(result.current.isSelected('3')).toBe(false);
      expect(result.current.isAllSelected).toBe(false);
      expect(result.current.isAnySelected).toBe(false);
      expect(result.current.countSelected).toBe(0);

      // Select all items
      act(() => {
        result.current.selectAll();
      });

      // Check that all items are selected (including virtual items not yet loaded)
      expect(result.current.isSelected('1')).toBe(true);
      expect(result.current.isSelected('2')).toBe(true);
      expect(result.current.isSelected('3')).toBe(true);
      expect(result.current.isAllSelected).toBe(true);
      expect(result.current.isAnySelected).toBe(true);
      expect(result.current.countSelected).toBe(3); // Total hits count
      expect(result.current.selectedIds).toBe('all'); // Special sentinel value

      // Deselect all
      act(() => {
        result.current.deselectAll();
      });

      // Check that nothing is selected
      expect(result.current.isSelected('1')).toBe(false);
      expect(result.current.isSelected('2')).toBe(false);
      expect(result.current.isSelected('3')).toBe(false);
      expect(result.current.isAllSelected).toBe(false);
      expect(result.current.isAnySelected).toBe(false);
      expect(result.current.countSelected).toBe(0);
      expect(result.current.selectedIds).toEqual([]);
    });
  });

  describe('More hits to load', () => {
    it('should return the correct initial state', () => {
      const {result} = renderHook(() =>
        useListItemCheckboxContext({hits: 10, knownIds: ['1', '2', '3'], queryKey})
      );
      expect(result.current).toEqual({
        countSelected: 0,
        deselectAll: expect.any(Function),
        hits: 10,
        isAllSelected: false,
        isAnySelected: false,
        isSelected: expect.any(Function),
        knownIds: ['1', '2', '3'],
        queryKey,
        selectAll: expect.any(Function),
        selectedIds: [],
        toggleSelected: expect.any(Function),
      });
    });

    it('should allow selecting individual items when there are more hits to load', () => {
      const {result} = renderHook(() =>
        useListItemCheckboxContext({hits: 10, knownIds: ['1', '2', '3'], queryKey})
      );

      // Initially nothing is selected
      expect(result.current.isSelected('1')).toBe(false);
      expect(result.current.isSelected('2')).toBe(false);
      expect(result.current.isSelected('3')).toBe(false);
      expect(result.current.isAllSelected).toBe(false);
      expect(result.current.isAnySelected).toBe(false);
      expect(result.current.countSelected).toBe(0);

      // Select item '1'
      act(() => {
        result.current.toggleSelected('1');
      });

      // Check that only item '1' is selected
      expect(result.current.isSelected('1')).toBe(true);
      expect(result.current.isSelected('2')).toBe(false);
      expect(result.current.isSelected('3')).toBe(false);
      expect(result.current.isAllSelected).toBe('indeterminate');
      expect(result.current.isAnySelected).toBe(true);
      expect(result.current.countSelected).toBe(1);
      expect(result.current.selectedIds).toEqual(['1']);

      // Select item '2' as well
      act(() => {
        result.current.toggleSelected('2');
      });

      // Check that both items are selected
      expect(result.current.isSelected('1')).toBe(true);
      expect(result.current.isSelected('2')).toBe(true);
      expect(result.current.isSelected('3')).toBe(false);
      expect(result.current.isAllSelected).toBe('indeterminate');
      expect(result.current.isAnySelected).toBe(true);
      expect(result.current.countSelected).toBe(2);
      expect(result.current.selectedIds).toEqual(['1', '2']);

      // Select item '3' to select all known items
      act(() => {
        result.current.toggleSelected('3');
      });

      // Check that all known items are selected
      expect(result.current.isSelected('1')).toBe(true);
      expect(result.current.isSelected('2')).toBe(true);
      expect(result.current.isSelected('3')).toBe(true);
      expect(result.current.isAllSelected).toBe('indeterminate');
      expect(result.current.isAnySelected).toBe(true);
      expect(result.current.countSelected).toBe(3);
      expect(result.current.selectedIds).toEqual(['1', '2', '3']);

      // Deselect item '1'
      act(() => {
        result.current.toggleSelected('1');
      });

      // Check that only items '2' and '3' are selected
      expect(result.current.isSelected('1')).toBe(false);
      expect(result.current.isSelected('2')).toBe(true);
      expect(result.current.isSelected('3')).toBe(true);
      expect(result.current.isAllSelected).toBe('indeterminate');
      expect(result.current.isAnySelected).toBe(true);
      expect(result.current.countSelected).toBe(2);
      expect(result.current.selectedIds).toEqual(['2', '3']);
    });

    it('should allow selecting all items with selectAll', () => {
      const {result} = renderHook(() =>
        useListItemCheckboxContext({hits: 10, knownIds: ['1', '2', '3'], queryKey})
      );

      // Initially nothing is selected
      expect(result.current.isSelected('1')).toBe(false);
      expect(result.current.isSelected('2')).toBe(false);
      expect(result.current.isSelected('3')).toBe(false);
      expect(result.current.isAllSelected).toBe(false);
      expect(result.current.isAnySelected).toBe(false);
      expect(result.current.countSelected).toBe(0);

      // Select all items
      act(() => {
        result.current.selectAll();
      });

      // Check that all items are selected (including virtual items not yet loaded)
      expect(result.current.isSelected('1')).toBe('all-selected');
      expect(result.current.isSelected('2')).toBe('all-selected');
      expect(result.current.isSelected('3')).toBe('all-selected');
      expect(result.current.isAllSelected).toBe(true);
      expect(result.current.isAnySelected).toBe(true);
      expect(result.current.countSelected).toBe(10); // Total hits count
      expect(result.current.selectedIds).toBe('all'); // Special sentinel value

      // Deselect all
      act(() => {
        result.current.deselectAll();
      });

      // Check that nothing is selected
      expect(result.current.isSelected('1')).toBe(false);
      expect(result.current.isSelected('2')).toBe(false);
      expect(result.current.isSelected('3')).toBe(false);
      expect(result.current.isAllSelected).toBe(false);
      expect(result.current.isAnySelected).toBe(false);
      expect(result.current.countSelected).toBe(0);
      expect(result.current.selectedIds).toEqual([]);
    });
  });
});
