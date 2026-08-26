import {useEffect, useLayoutEffect, useRef} from 'react';

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

/**
 * Keeps each tab's scroll position independent while the transcript and
 * timeline share a single scroll container.
 *
 * Returning to a tab restores where the user left it. When a span is selected,
 * switching tabs scrolls that span's row into view instead, so the selection
 * stays visible across both views. The selected row is located by its
 * `data-selected="true"` attribute, which both views set on the highlighted row.
 */
export function useConversationScrollRestoration({
  activeTab,
  selectedNodeId,
}: UseConversationScrollRestorationOptions) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Last-known scroll offset per tab. Written continuously from a scroll
  // listener so the outgoing tab's offset is captured before swapping views
  // clamps scrollTop against the other view's (usually shorter) height.
  const offsetByTab = useRef({
    transcript: 0,
    timeline: 0,
  });

  // The scroll listener is attached once, so it reads the active tab from a ref
  // to always record against the tab that is currently visible.
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

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
    const container = scrollContainerRef.current;
    if (!container) {
      return;
    }

    if (selectedNodeId) {
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

  return scrollContainerRef;
}
