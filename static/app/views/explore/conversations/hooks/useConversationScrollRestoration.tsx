import {useCallback, useEffect, useLayoutEffect, useRef} from 'react';

import type {ConversationViewTab} from 'sentry/views/explore/conversations/components/conversationView';

interface UseConversationScrollRestorationOptions {
  /** The currently visible tab. */
  activeTab: ConversationViewTab;
  /**
   * The id of the currently selected span, or null when nothing is selected.
   * When set, switching tabs reveals its row instead of restoring the offset.
   */
  selectedNodeId: string | null;
}

function scrollToCenter(container: HTMLElement, range: Range) {
  const rangeRect = range.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  container.scrollTop +=
    rangeRect.top - containerRect.top - (container.clientHeight - rangeRect.height) / 2;
}

/**
 * Keeps each tab's scroll position independent while the transcript and
 * timeline share a single scroll container.
 *
 * Returning to a tab restores where the user left it. When a span is selected,
 * switching tabs scrolls that span's row into view instead, so the selection
 * stays visible across both views. The selected row is located by its
 * `data-selected="true"` attribute, which both views set on the highlighted row.
 *
 * `centerOnSelect` centers a range inside a span, e.g. a search match, once that
 * span is selected. It waits for the selection to commit, since opening the span's
 * details beside the transcript reflows it.
 */
export function useConversationScrollRestoration({
  activeTab,
  selectedNodeId,
}: UseConversationScrollRestorationOptions) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Last-known scroll offset per tab. Written continuously from a scroll
  // listener so the outgoing tab's offset is captured before swapping views
  // clamps scrollTop against the other view's (usually shorter) height.
  const offsetByTab = useRef({transcript: 0, timeline: 0});

  // The scroll listener is attached once, so it reads the active tab from a ref
  // to always record against the tab that is currently visible.
  const activeTabRef = useRef(activeTab);
  const selectedNodeIdRef = useRef(selectedNodeId);
  const pendingCenterRef = useRef<{nodeId: string; range: Range} | null>(null);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) {
      return;
    }

    const handleScroll = () => {
      offsetByTab.current[activeTabRef.current] = container.scrollTop;
    };

    container.addEventListener('scroll', handleScroll, {passive: true});
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  useLayoutEffect(() => {
    // Only committed tabs may receive scroll events; a suspended render can
    // leave the previous tab visible and scrollable.
    activeTabRef.current = activeTab;
    selectedNodeIdRef.current = selectedNodeId;
    const pendingCenter = pendingCenterRef.current;
    pendingCenterRef.current = null;
    const container = scrollContainerRef.current;
    if (!container) {
      return;
    }

    if (selectedNodeId) {
      if (
        pendingCenter?.nodeId === selectedNodeId &&
        container.contains(pendingCenter.range.startContainer)
      ) {
        scrollToCenter(container, pendingCenter.range);
        offsetByTab.current[activeTab] = container.scrollTop;
        return;
      }
      const selectedRow = container.querySelector<HTMLElement>('[data-selected="true"]');
      if (selectedRow) {
        selectedRow.scrollIntoView({block: 'nearest'});
        // Keep the saved offset in sync so switching away and back lands here.
        offsetByTab.current[activeTab] = container.scrollTop;
        return;
      }
    }

    container.scrollTop = offsetByTab.current[activeTab];
  }, [activeTab, selectedNodeId]);

  const centerOnSelect = useCallback((nodeId: string, range: Range) => {
    const container = scrollContainerRef.current;
    if (nodeId !== selectedNodeIdRef.current) {
      pendingCenterRef.current = {nodeId, range};
    } else if (container) {
      scrollToCenter(container, range);
    }
  }, []);

  return {scrollContainerRef, centerOnSelect};
}
