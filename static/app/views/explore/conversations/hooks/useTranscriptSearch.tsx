import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type RefObject,
} from 'react';

const MATCH_HIGHLIGHT = 'conversation-search-match';
const CURRENT_HIGHLIGHT = 'conversation-search-current';

type TranscriptSearchStatus = 'idle' | 'searching' | 'found' | 'no-results';

interface TranscriptMatch {
  range: Range;
  spanId: string;
}

interface UseTranscriptSearchOptions {
  canLoadMore: boolean;
  isLoadingMore: boolean;
  loadMore: () => void;
  onSelectSpan: (spanId: string) => void;
  rootRef: RefObject<HTMLElement | null>;
}

function findMatches(root: HTMLElement, query: string): TranscriptMatch[] {
  const pattern = new RegExp(RegExp.escape(query), 'gi');
  const matches: TranscriptMatch[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    // Only text inside transcript blocks, which carry the span they render. Skip
    // collapsed blocks' titles: they preview the block's own text, so it would count
    // twice until the block opens.
    const element = node.parentElement;
    const spanId = element?.closest('[data-node-id]')?.getAttribute('data-node-id');
    if (!spanId || element?.closest('summary')) {
      continue;
    }
    for (const match of (node.nodeValue ?? '').matchAll(pattern)) {
      const range = document.createRange();
      range.setStart(node, match.index);
      range.setEnd(node, match.index + match[0].length);
      matches.push({range, spanId});
    }
  }
  return matches;
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

function highlight(matches: TranscriptMatch[], current: TranscriptMatch | null) {
  if (!supportsHighlights()) {
    return;
  }
  CSS.highlights.set(MATCH_HIGHLIGHT, new Highlight(...matches.map(m => m.range)));
  CSS.highlights.set(
    CURRENT_HIGHLIGHT,
    current ? new Highlight(current.range) : new Highlight()
  );
}

function clearHighlights() {
  if (!supportsHighlights()) {
    return;
  }
  CSS.highlights.delete(MATCH_HIGHLIGHT);
  CSS.highlights.delete(CURRENT_HIGHLIGHT);
}

/**
 * Searches the text the transcript shows, like browser find, loading more pages while
 * the loaded ones don't have the occurrence it's after.
 */
export function useTranscriptSearch({
  rootRef,
  canLoadMore,
  isLoadingMore,
  loadMore,
  onSelectSpan,
}: UseTranscriptSearchOptions) {
  const [search, setSearch] = useState<{index: number | 'last'; query: string} | null>(
    null
  );
  const [status, setStatus] = useState<TranscriptSearchStatus>('idle');
  const [matchCount, setMatchCount] = useState(0);
  const revealedRef = useRef<string | null>(null);
  const loadNextPage = useEffectEvent(() => loadMore());
  const selectSpan = useEffectEvent((spanId: string) => onSelectSpan(spanId));

  const step = useCallback(
    (direction: 1 | -1) => {
      if (!search || status !== 'found' || search.index === 'last') {
        return;
      }
      const index = search.index + direction;
      setSearch({query: search.query, index: index < 0 ? 'last' : index});
    },
    [search, status]
  );

  const submit = useCallback(
    (query: string, backwards = false) => {
      if (search?.query === query) {
        step(backwards ? -1 : 1);
        return;
      }
      revealedRef.current = null;
      setSearch({query, index: 0});
    },
    [search, step]
  );

  const clear = useCallback(() => {
    revealedRef.current = null;
    setSearch(null);
    setStatus('idle');
    setMatchCount(0);
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !search) {
      clearHighlights();
      return;
    }
    const {query, index} = search;

    let frame: number | null = null;
    const apply = () => {
      frame = null;
      const matches = findMatches(root, query);
      setMatchCount(matches.length);

      if (index === 'last') {
        if (canLoadMore) {
          highlight(matches, null);
          setStatus('searching');
          if (!isLoadingMore) {
            loadNextPage();
          }
        } else if (matches.length === 0) {
          highlight(matches, null);
          setStatus('no-results');
        } else {
          setSearch({query, index: matches.length - 1});
        }
        return;
      }

      const current = matches[index];

      if (!current) {
        highlight(matches, null);
        if (canLoadMore) {
          setStatus('searching');
          if (!isLoadingMore) {
            loadNextPage();
          }
        } else if (matches.length === 0) {
          setStatus('no-results');
        } else {
          // Past the last occurrence with nothing left to load: start over, like
          // browser find.
          revealedRef.current = null;
          setSearch({query, index: 0});
        }
        return;
      }

      setStatus('found');
      highlight(matches, current);
      const revealKey = `${query}\u0000${index}`;
      if (revealedRef.current === revealKey) {
        return;
      }
      revealedRef.current = revealKey;
      let details = current.range.startContainer.parentElement?.closest('details');
      while (details) {
        details.open = true;
        details = details.parentElement?.closest('details');
      }
      selectSpan(current.spanId);
      // Selecting opens the span details beside the transcript, which reflows it.
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          const element = current.range.startContainer.parentElement;
          if (element) {
            scrollToCenter(element);
          }
        })
      );
    };

    // Pages load and blocks open while searching, so search again when the
    // transcript changes.
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
    };
  }, [rootRef, search, canLoadMore, isLoadingMore]);

  useEffect(() => clearHighlights, []);

  return {
    status,
    submit,
    clear,
    next: () => step(1),
    previous: () => step(-1),
    index: typeof search?.index === 'number' ? search.index : null,
    matchCount,
    hasMore: canLoadMore,
  };
}
