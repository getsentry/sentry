import {renderHook} from 'sentry-test/reactTestingLibrary';

import type {Block} from 'sentry/views/seerExplorer/types';

import {useBlockNavigation} from './useBlockNavigation';

describe('useBlockNavigation', () => {
  const mockBlocks: Block[] = [
    {
      id: 'block-1',
      type: 'user-input',
      content: 'First message',
      timestamp: '2024-01-01T00:00:00Z',
      loading: false,
    },
    {
      id: 'block-2',
      type: 'response',
      content: 'First response',
      timestamp: '2024-01-01T00:01:00Z',
      loading: false,
    },
    {
      id: 'block-3',
      type: 'user-input',
      content: 'Second message',
      timestamp: '2024-01-01T00:02:00Z',
      loading: false,
    },
  ];

  const createMockElement = () => ({
    scrollIntoView: jest.fn(),
  });

  const createMockTextarea = () => ({
    focus: jest.fn(),
    scrollIntoView: jest.fn(),
  });

  const defaultProps = {
    isOpen: true,
    focusedBlockIndex: -1,
    blocks: mockBlocks,
    blockRefs: {current: [createMockElement(), createMockElement(), createMockElement()]},
    textareaRef: {current: createMockTextarea()},
    setFocusedBlockIndex: jest.fn(),
    onDeleteFromIndex: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset all mock methods
    defaultProps.blockRefs.current.forEach(el => {
      if (el) {
        el.scrollIntoView.mockClear();
      }
    });
    if (defaultProps.textareaRef.current) {
      defaultProps.textareaRef.current.focus.mockClear();
      defaultProps.textareaRef.current.scrollIntoView.mockClear();
    }
    defaultProps.setFocusedBlockIndex.mockClear();
    defaultProps.onDeleteFromIndex?.mockClear();
  });

  describe('Arrow Key Navigation', () => {
    it('moves from input to last block on ArrowUp', () => {
      renderHook(() => useBlockNavigation(defaultProps));

      // Simulate ArrowUp keydown
      const event = new KeyboardEvent('keydown', {key: 'ArrowUp'});
      document.dispatchEvent(event);

      expect(defaultProps.setFocusedBlockIndex).toHaveBeenCalledWith(2); // Last block index
      expect(defaultProps.blockRefs.current[2]?.scrollIntoView).toHaveBeenCalledWith({
        block: 'nearest',
      });
    });

    it('moves up through blocks on ArrowUp', () => {
      const props = {...defaultProps, focusedBlockIndex: 2};
      renderHook(() => useBlockNavigation(props));

      const event = new KeyboardEvent('keydown', {key: 'ArrowUp'});
      document.dispatchEvent(event);

      expect(props.setFocusedBlockIndex).toHaveBeenCalledWith(1);
      expect(props.blockRefs.current[1]?.scrollIntoView).toHaveBeenCalledWith({
        block: 'nearest',
      });
    });

    it('does not move up from first block', () => {
      const props = {...defaultProps, focusedBlockIndex: 0};
      renderHook(() => useBlockNavigation(props));

      const event = new KeyboardEvent('keydown', {key: 'ArrowUp'});
      document.dispatchEvent(event);

      // Should not call setFocusedBlockIndex when already at first block
      expect(props.setFocusedBlockIndex).not.toHaveBeenCalled();
    });

    it('moves down through blocks on ArrowDown', () => {
      const props = {...defaultProps, focusedBlockIndex: 0};
      renderHook(() => useBlockNavigation(props));

      const event = new KeyboardEvent('keydown', {key: 'ArrowDown'});
      document.dispatchEvent(event);

      expect(props.setFocusedBlockIndex).toHaveBeenCalledWith(1);
      expect(props.blockRefs.current[1]?.scrollIntoView).toHaveBeenCalledWith({
        block: 'nearest',
      });
    });

    it('moves from last block to input on ArrowDown', () => {
      const props = {...defaultProps, focusedBlockIndex: 2};
      renderHook(() => useBlockNavigation(props));

      const event = new KeyboardEvent('keydown', {key: 'ArrowDown'});
      document.dispatchEvent(event);

      expect(props.setFocusedBlockIndex).toHaveBeenCalledWith(-1);
      expect(props.textareaRef.current?.focus).toHaveBeenCalled();
      expect(props.textareaRef.current?.scrollIntoView).toHaveBeenCalledWith({
        block: 'nearest',
      });
    });

    it('does nothing on ArrowDown when already at input', () => {
      renderHook(() => useBlockNavigation(defaultProps));

      const event = new KeyboardEvent('keydown', {key: 'ArrowDown'});
      document.dispatchEvent(event);

      expect(defaultProps.setFocusedBlockIndex).not.toHaveBeenCalled();
    });
  });

  describe('Tab Navigation', () => {
    it('always returns to input on Tab', () => {
      const props = {...defaultProps, focusedBlockIndex: 1};
      renderHook(() => useBlockNavigation(props));

      const event = new KeyboardEvent('keydown', {key: 'Tab'});
      document.dispatchEvent(event);

      expect(props.setFocusedBlockIndex).toHaveBeenCalledWith(-1);
      expect(props.textareaRef.current?.focus).toHaveBeenCalled();
      expect(props.textareaRef.current?.scrollIntoView).toHaveBeenCalledWith({
        block: 'nearest',
      });
    });

    it('focuses textarea even when already at input', () => {
      renderHook(() => useBlockNavigation(defaultProps));

      const event = new KeyboardEvent('keydown', {key: 'Tab'});
      document.dispatchEvent(event);

      expect(defaultProps.setFocusedBlockIndex).toHaveBeenCalledWith(-1);
      expect(defaultProps.textareaRef.current?.focus).toHaveBeenCalled();
    });
  });

  describe('Backspace/Delete Navigation', () => {
    it('deletes from focused block index on Backspace', () => {
      const props = {...defaultProps, focusedBlockIndex: 1};
      renderHook(() => useBlockNavigation(props));

      const event = new KeyboardEvent('keydown', {key: 'Backspace'});
      document.dispatchEvent(event);

      expect(props.onDeleteFromIndex).toHaveBeenCalledWith(1);
      expect(props.setFocusedBlockIndex).toHaveBeenCalledWith(-1);
      expect(props.textareaRef.current?.focus).toHaveBeenCalled();
    });

    it('does not delete when focused on input', () => {
      renderHook(() => useBlockNavigation(defaultProps));

      const event = new KeyboardEvent('keydown', {key: 'Backspace'});
      document.dispatchEvent(event);

      expect(defaultProps.onDeleteFromIndex).not.toHaveBeenCalled();
    });

    it('does not delete when onDeleteFromIndex is not provided', () => {
      const props = {...defaultProps, focusedBlockIndex: 1, onDeleteFromIndex: undefined};
      renderHook(() => useBlockNavigation(props));

      const event = new KeyboardEvent('keydown', {key: 'Backspace'});
      document.dispatchEvent(event);

      // Should still return focus to input
      expect(props.setFocusedBlockIndex).toHaveBeenCalledWith(-1);
      expect(props.textareaRef.current?.focus).toHaveBeenCalled();
    });
  });

  describe('Panel State Control', () => {
    it('ignores keyboard events when panel is closed', () => {
      const props = {...defaultProps, isOpen: false};
      renderHook(() => useBlockNavigation(props));

      const event = new KeyboardEvent('keydown', {key: 'ArrowUp'});
      document.dispatchEvent(event);

      expect(props.setFocusedBlockIndex).not.toHaveBeenCalled();
    });

    it('responds to keyboard events when panel is open', () => {
      const props = {...defaultProps, isOpen: true};
      renderHook(() => useBlockNavigation(props));

      const event = new KeyboardEvent('keydown', {key: 'Tab'});
      document.dispatchEvent(event);

      expect(props.setFocusedBlockIndex).toHaveBeenCalled();
    });
  });

  describe('Empty Blocks Handling', () => {
    it('handles empty blocks array gracefully', () => {
      const props = {...defaultProps, blocks: [], blockRefs: {current: []}};
      renderHook(() => useBlockNavigation(props));

      const event = new KeyboardEvent('keydown', {key: 'ArrowUp'});
      document.dispatchEvent(event);

      // Should set focused index to -1 (last block in empty array)
      expect(props.setFocusedBlockIndex).toHaveBeenCalledWith(-1);
    });

    it('handles single block navigation', () => {
      const singleBlock = [mockBlocks[0]];
      const props = {
        ...defaultProps,
        blocks: singleBlock,
        blockRefs: {current: [createMockElement()]},
      };
      renderHook(() => useBlockNavigation(props));

      // ArrowUp from input should go to block 0
      const arrowUpEvent = new KeyboardEvent('keydown', {key: 'ArrowUp'});
      document.dispatchEvent(arrowUpEvent);
      expect(props.setFocusedBlockIndex).toHaveBeenCalledWith(0);

      // Reset mock
      props.setFocusedBlockIndex.mockClear();

      // ArrowDown from block 0 should go to input
      const propsAtBlock0 = {...props, focusedBlockIndex: 0};
      renderHook(() => useBlockNavigation(propsAtBlock0));

      const arrowDownEvent = new KeyboardEvent('keydown', {key: 'ArrowDown'});
      document.dispatchEvent(arrowDownEvent);
      expect(props.setFocusedBlockIndex).toHaveBeenCalledWith(-1);
    });
  });

  describe('Event Cleanup', () => {
    it('removes event listener on unmount', () => {
      const removeEventListenerSpy = jest.spyOn(document, 'removeEventListener');
      const {unmount} = renderHook(() => useBlockNavigation(defaultProps));

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'keydown',
        expect.any(Function)
      );
      removeEventListenerSpy.mockRestore();
    });

    it('updates event listener when dependencies change', () => {
      const addEventListenerSpy = jest.spyOn(document, 'addEventListener');
      const removeEventListenerSpy = jest.spyOn(document, 'removeEventListener');

      const {rerender} = renderHook(props => useBlockNavigation(props), {
        initialProps: defaultProps,
      });

      const callCount = addEventListenerSpy.mock.calls.length;

      // Change a dependency
      rerender({...defaultProps, focusedBlockIndex: 1});

      // Should have added new listener and removed old one
      expect(addEventListenerSpy).toHaveBeenCalledTimes(callCount + 1);
      expect(removeEventListenerSpy).toHaveBeenCalled();

      addEventListenerSpy.mockRestore();
      removeEventListenerSpy.mockRestore();
    });
  });

  describe('Ref Handling', () => {
    it('handles null block refs gracefully', () => {
      const props = {
        ...defaultProps,
        blockRefs: {current: [null, createMockElement(), null]},
      };
      renderHook(() => useBlockNavigation(props));

      const event = new KeyboardEvent('keydown', {key: 'ArrowUp'});
      document.dispatchEvent(event);

      // Should not throw error with null refs
      expect(props.setFocusedBlockIndex).toHaveBeenCalledWith(2);
    });

    it('handles null textarea ref gracefully', () => {
      const props = {...defaultProps, textareaRef: {current: null}};
      renderHook(() => useBlockNavigation(props));

      const event = new KeyboardEvent('keydown', {key: 'Tab'});
      document.dispatchEvent(event);

      // Should not throw error with null textarea ref
      expect(props.setFocusedBlockIndex).toHaveBeenCalledWith(-1);
    });
  });
});
