import {useEffect, useRef, type RefObject} from 'react';

const MATCH_HIGHLIGHT = 'conversation-search-match';
const CURRENT_HIGHLIGHT = 'conversation-search-current';

interface UseTranscriptSearchHighlightOptions {
  currentSpanId: string | null;
  query: string | null;
  rootRef: RefObject<HTMLElement | null>;
}

function findRanges(root: HTMLElement, query: string, currentSpanId: string | null) {
  const pattern = new RegExp(RegExp.escape(query), 'gi');
  const all: Range[] = [];
  const current: Range[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    // Only transcript blocks, not the span details beside them.
    const owner = node.parentElement?.closest('[data-node-id]');
    if (!owner) {
      continue;
    }
    const text = node.nodeValue ?? '';
    for (const match of text.matchAll(pattern)) {
      const range = document.createRange();
      range.setStart(node, match.index);
      range.setEnd(node, match.index + match[0].length);
      all.push(range);
      if (currentSpanId && owner.getAttribute('data-node-id') === currentSpanId) {
        current.push(range);
      }
    }
  }
  return {all, current};
}

// Scrolls only the nearest scrolling ancestor; `scrollIntoView` would also move the
// page around the transcript.
function scrollToCenter(element: HTMLElement) {
  let scroller = element.parentElement;
  while (scroller && !/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)) {
    scroller = scroller.parentElement;
  }
  if (!scroller) {
    return;
  }
  const elementRect = element.getBoundingClientRect();
  const scrollerRect = scroller.getBoundingClientRect();
  scroller.scrollTop +=
    elementRect.top - scrollerRect.top - (scroller.clientHeight - elementRect.height) / 2;
}

function supportsHighlights() {
  return typeof CSS !== 'undefined' && 'highlights' in CSS;
}

function clearHighlights() {
  if (!supportsHighlights()) {
    return;
  }
  CSS.highlights.delete(MATCH_HIGHLIGHT);
  CSS.highlights.delete(CURRENT_HIGHLIGHT);
}

/**
 * Marks every occurrence of the query in the transcript, like browser find, and
 * reveals the selected match's own: opens collapsed blocks holding them and scrolls
 * to the first.
 */
export function useTranscriptSearchHighlight({
  rootRef,
  query,
  currentSpanId,
}: UseTranscriptSearchHighlightOptions) {
  const revealedRef = useRef<string | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !query || !supportsHighlights()) {
      clearHighlights();
      return;
    }

    let frame: number | null = null;
    const apply = () => {
      frame = null;
      const {all, current} = findRanges(root, query, currentSpanId);
      CSS.highlights.set(MATCH_HIGHLIGHT, new Highlight(...all));
      CSS.highlights.set(CURRENT_HIGHLIGHT, new Highlight(...current));

      const revealKey = `${query}\u0000${currentSpanId}`;
      if (!currentSpanId || revealedRef.current === revealKey) {
        return;
      }
      const first = current[0];
      if (!first) {
        // The query is only in parts of the span the transcript doesn't show, like
        // its input history, so center its selected block instead.
        const selected = root.querySelector<HTMLElement>(
          `[data-node-id="${currentSpanId}"] [data-selected="true"], [data-node-id="${currentSpanId}"][data-selected="true"]`
        );
        if (selected) {
          revealedRef.current = revealKey;
          scrollToCenter(selected);
        }
        return;
      }
      revealedRef.current = revealKey;
      for (const range of current) {
        let details = range.startContainer.parentElement?.closest('details');
        while (details) {
          details.open = true;
          details = details.parentElement?.closest('details');
        }
      }
      const element = first.startContainer.parentElement;
      if (element) {
        scrollToCenter(element);
      }
    };

    // Pages load and blocks open after the search, so re-mark when the transcript
    // changes.
    const schedule = () => {
      if (frame === null) {
        frame = requestAnimationFrame(apply);
      }
    };
    const observer = new MutationObserver(schedule);
    observer.observe(root, {childList: true, subtree: true, characterData: true});
    schedule();

    return () => {
      observer.disconnect();
      if (frame !== null) {
        cancelAnimationFrame(frame);
      }
      clearHighlights();
    };
  }, [rootRef, query, currentSpanId]);
}
