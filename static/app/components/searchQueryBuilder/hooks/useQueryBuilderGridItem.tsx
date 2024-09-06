import {type RefObject, useCallback} from 'react';
import {focusSafely, getFocusableTreeWalker} from '@react-aria/focus';
import {useGridListItem} from '@react-aria/gridlist';
import type {ListState} from '@react-stately/list';
import type {FocusableElement, Node} from '@react-types/shared';

import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/context';
import type {ParseResultToken} from 'sentry/components/searchSyntax/parser';

function isInputElement(target: EventTarget): target is HTMLInputElement {
  return target instanceof HTMLInputElement;
}

const noop = () => {};

/**
 * Modified version of React Aria's useGridListItem to support the search component.
 *
 * The default behavior of useGridListItem is to focus the next grid cell when navigating
 * left/right, and to wrap when at the end. However, we want to jump to the next token,
 * so we need to handle this ourselves. We also want to handle some special cases when
 * focus is inside an input.
 *
 * See https://react-spectrum.adobe.com/react-aria/useGridListItem.html
 */
export function useQueryBuilderGridItem(
  item: Node<ParseResultToken>,
  state: ListState<ParseResultToken>,
  ref: RefObject<FocusableElement>
) {
  const {wrapperRef} = useSearchQueryBuilder();
  const {rowProps, gridCellProps} = useGridListItem({node: item}, state, ref);

  // When focus is inside the input, we want to handle some things differently.
  // Returns true if the default behavior should be used, false if not.
  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>, input: HTMLInputElement): boolean => {
      // If the focus is within a combobox menu, let the combobox handle the event
      if (input.hasAttribute('aria-activedescendant')) {
        return false;
      }

      if (input.selectionStart === 0 && input.selectionEnd === 0) {
        // At start and going left, focus the previous grid cell (default behavior)
        if (e.key === 'ArrowLeft') {
          return true;
        }
      }

      if (
        input.selectionStart === input.value.length &&
        input.selectionEnd === input.value.length
      ) {
        // At end and going right, focus the next grid cell (default behavior)
        if (e.key === 'ArrowRight') {
          return true;
        }
      }

      // Otherwise, let the input handle the event
      return false;
    },
    []
  );

  const onKeyDownCapture = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (isInputElement(e.target)) {
        const shouldUseDefaultBehavior = handleInputKeyDown(e, e.target);
        if (!shouldUseDefaultBehavior) {
          return;
        }
      }

      if (!document.activeElement || !e.currentTarget.contains(e.target as Element)) {
        return;
      }

      const walker = getFocusableTreeWalker(e.currentTarget, {
        wrap: false,
        accept: node => node.tagName === 'BUTTON',
      });
      walker.currentNode = e.target as FocusableElement;

      // On ArrowRight, we want to focus the next grid cell if there is one.
      // If there are no other sibling cells, focus the first grid cell of the
      // next token.
      if (e.key === 'ArrowRight') {
        const nextFocusableChild = walker.nextSibling();
        if (nextFocusableChild) {
          e.preventDefault();
          e.stopPropagation();
          focusSafely(nextFocusableChild as FocusableElement);
        } else {
          e.preventDefault();
          e.stopPropagation();

          // Focus the next token
          const el = wrapperRef.current?.querySelector(
            `[data-key="${state.collection.getKeyAfter(item.key)}"]`
          );

          if (el) {
            const newWalker = getFocusableTreeWalker(el);
            const firstChild = newWalker.firstChild();

            if (firstChild) {
              (firstChild as HTMLElement).focus();
            }
          }
        }
      }
      // On ArrowRight, we want to focus the previous grid cell if there is one.
      // If there are no previous sibling cells, focus the last grid cell of the
      // previous token.
      if (e.key === 'ArrowLeft') {
        const previousFocusableChild = walker.previousSibling();

        if (previousFocusableChild) {
          e.preventDefault();
          e.stopPropagation();
          focusSafely(previousFocusableChild as FocusableElement);
        } else {
          e.preventDefault();
          e.stopPropagation();

          // Focus the previous token
          const el = wrapperRef.current?.querySelector(
            `[data-key="${state.collection.getKeyBefore(item.key)}"]`
          );

          if (el) {
            const newWalker = getFocusableTreeWalker(el);
            const lastChild = newWalker.lastChild();

            if (lastChild) {
              (lastChild as HTMLElement).focus();
            }
          }
        }
      }
    },
    [handleInputKeyDown, item.key, state.collection, wrapperRef]
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      switch (e.key) {
        // Default Behavior is for Enter and Space to select the item
        case 'Enter':
        case 'Space':
          break;
        default:
          gridCellProps.onKeyDown?.(e);
      }
    },
    [gridCellProps]
  );

  return {
    rowProps: {
      ...rowProps,
      onKeyDownCapture,
      onKeyDown,
      // Default behavior is for click events to select the item
      onClick: noop,
      onMouseDown: noop,
      onPointerDown: noop,
    },
    gridCellProps,
  };
}
