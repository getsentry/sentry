import type {KeyboardEvent, PointerEvent, ReactNode} from 'react';
import {useCallback, useRef} from 'react';
import styled from '@emotion/styled';

const PAGE_EDGE_PADDING_PX = 16;

/**
 * Autocomplete menus can render inside this wrapper rather than a portal. Selecting an
 * option depends on the pointer sequence completing untouched, so menu targets are
 * always left alone by the capture handlers below.
 */
const MENU_TARGETS = '[data-overlay], [role="listbox"], [role="option"]';
const CONTROL_TARGETS = 'input, textarea, button, a, [role="button"]';

function closestMatch(target: EventTarget | null, selector: string) {
  return target instanceof Element ? target.closest(selector) : null;
}

function focusInputAtEnd(input: HTMLInputElement) {
  input.focus();
  const end = input.value.length;
  input.setSelectionRange(end, end);
}

/**
 * Grows a series filter bar to the remaining window width while focused so a long query
 * has room to be read and edited, then collapses it back into the toolbar column.
 */
export function ExpandableFilterSearchBar({children}: {children: ReactNode}) {
  const ref = useRef<HTMLDivElement>(null);

  const expandToPageWidth = useCallback(() => {
    const el = ref.current;
    if (!el || el.dataset.expanded === 'true') {
      return;
    }
    const {left} = el.getBoundingClientRect();
    // Expand instantly so focus and the caret are not racing the width animation.
    el.style.transition = 'none';
    el.style.width = `${document.documentElement.clientWidth - left - PAGE_EDGE_PADDING_PX}px`;
    el.dataset.expanded = 'true';
    requestAnimationFrame(() => {
      if (ref.current) {
        ref.current.style.transition = '';
      }
    });
  }, []);

  const collapseToDefaultWidth = useCallback(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    el.style.width = '';
    delete el.dataset.expanded;
  }, []);

  const isSuggestionMenuOpen = useCallback(() => {
    return Boolean(ref.current?.querySelector('[role="combobox"][aria-expanded="true"]'));
  }, []);

  const collapseAfterBlur = useCallback(() => {
    // Defer past the menu close and focus handoff. Suggestion menus can briefly keep
    // aria-expanded while focus leaves, so a second frame lets that settle.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = ref.current;
        if (!el || el.contains(document.activeElement) || isSuggestionMenuOpen()) {
          return;
        }
        collapseToDefaultWidth();
      });
    });
  }, [collapseToDefaultWidth, isSuggestionMenuOpen]);

  const focusTrailingInput = useCallback(() => {
    const input = ref.current?.querySelector<HTMLInputElement>(
      '[data-test-id="query-builder-input"]'
    );
    if (!input) {
      return;
    }

    // Focus the grid row before the free text input so React Aria updates its focused
    // key. Focusing the input alone can leave the focused key on a filter token, which
    // steals focus straight back and leaves no caret until a second click.
    input.closest<HTMLElement>('[role="row"]')?.focus();
    focusInputAtEnd(input);
  }, []);

  const onPointerDownCapture = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const el = ref.current;
      if (!el || closestMatch(event.target, MENU_TARGETS)) {
        return;
      }

      if (el.dataset.expanded === 'true') {
        // Already expanded, so only route clicks on empty chrome to the trailing input.
        if (!closestMatch(event.target, CONTROL_TARGETS)) {
          event.preventDefault();
          focusTrailingInput();
        }
        return;
      }

      // While collapsed the bar is often wrapped onto several lines, and expanding
      // reflows tokens out from under the pointer, so the browser cannot place the caret
      // reliably. Take over this first click and put the caret at the end of the trailing
      // input instead; individual tokens stay editable on subsequent clicks.
      event.preventDefault();
      expandToPageWidth();
      focusTrailingInput();
      requestAnimationFrame(() => {
        focusTrailingInput();
      });
    },
    [expandToPageWidth, focusTrailingInput]
  );

  const collapseOnEnter = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      // Accepting an autocomplete suggestion also uses Enter, so stay expanded while a
      // menu is open.
      if (
        event.key !== 'Enter' ||
        event.nativeEvent.isComposing ||
        isSuggestionMenuOpen()
      ) {
        return;
      }

      const active = document.activeElement;
      if (active instanceof HTMLElement && ref.current?.contains(active)) {
        active.blur();
      }
      collapseToDefaultWidth();
    },
    [collapseToDefaultWidth, isSuggestionMenuOpen]
  );

  return (
    <ExpandableFilterSearchBarWrapper
      ref={ref}
      onPointerDownCapture={onPointerDownCapture}
      onFocusCapture={expandToPageWidth}
      onBlurCapture={collapseAfterBlur}
      onKeyDownCapture={collapseOnEnter}
    >
      {children}
    </ExpandableFilterSearchBarWrapper>
  );
}

const ExpandableFilterSearchBarWrapper = styled('div')`
  width: 100%;
  min-width: 0;
  position: relative;
  /* Clip long queries while collapsed; overlays escape once expanded. */
  overflow: hidden;
  transition: width ${p => p.theme.motion.smooth.moderate};

  [data-test-id='search-query-builder'] {
    max-width: 100%;
    resize: none;
  }

  /* The measuring overlay sits above the input and swallows caret placement clicks. */
  [data-hidden-text] {
    pointer-events: none;
  }

  &[data-expanded='true'],
  &:focus-within {
    overflow: visible;
    /* Above Explore chart content, below CompactSelect overlays (dropdown) and
     * AttributeDetails (tooltip) so argument menus/tooltips stay usable. */
    z-index: ${p => p.theme.zIndex.header};

    [data-test-id='search-query-builder'] {
      background-color: ${p => p.theme.tokens.background.primary};
    }
  }
`;
