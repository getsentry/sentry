import {useCallback, useEffect, useState} from 'react';

import type {CollapsibleExpandAll} from 'sentry/components/ai/chat/collapsibleContent';

interface UseTranscriptExpandAllOptions {
  canLoadMore: boolean;
  hasMorePages: boolean;
  isLoadingMore: boolean;
  loadMore: () => void;
}

/**
 * Expand all loads every remaining page first, so the whole transcript opens and
 * browser find can search it; collapse all applies right away.
 */
export function useTranscriptExpandAll({
  canLoadMore,
  hasMorePages,
  isLoadingMore,
  loadMore,
}: UseTranscriptExpandAllOptions) {
  const [applied, setApplied] = useState<CollapsibleExpandAll | null>(null);
  const [pending, setPending] = useState<CollapsibleExpandAll | null>(null);

  const isLoadingAll = pending !== null && (canLoadMore || isLoadingMore);

  useEffect(() => {
    if (pending && canLoadMore && !isLoadingMore) {
      loadMore();
    }
  }, [pending, canLoadMore, isLoadingMore, loadMore]);

  const generation = Math.max(applied?.generation ?? 0, pending?.generation ?? 0);

  const expand = useCallback(() => {
    setPending({generation: generation + 1, open: true});
  }, [generation]);

  const collapse = useCallback(() => {
    setPending(null);
    setApplied({generation: generation + 1, open: false});
  }, [generation]);

  const cancel = useCallback(() => setPending(null), []);

  const expandAll = pending && !isLoadingAll ? pending : applied;
  const isExpanded = expandAll?.open === true;

  return {
    expandAll,
    isExpanded,
    isLoadingAll,
    // The page limit stopped loading before the end of the conversation.
    isPartial: isExpanded && hasMorePages,
    expand,
    collapse,
    cancel,
  };
}
