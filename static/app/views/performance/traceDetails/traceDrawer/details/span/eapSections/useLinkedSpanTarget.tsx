import type {Location} from 'history';

import type {Organization} from 'sentry/types/organization';
import {generateLinkToEventInTraceView} from 'sentry/utils/discover/urls';
import type {TraceItemResponseLink} from 'sentry/views/explore/hooks/useTraceItemDetails';
import type {TraceTree} from 'sentry/views/performance/traceDetails/traceModels/traceTree';
import type {BaseNode} from 'sentry/views/performance/traceDetails/traceModels/traceTreeNode/baseNode';
import {useTraceStateDispatch} from 'sentry/views/performance/traceDetails/traceState/traceStateProvider';
import {TraceLayoutTabKeys} from 'sentry/views/performance/traceDetails/useTraceLayoutTabs';

interface UseLinkedSpanTargetOptions {
  link: TraceItemResponseLink;
  location: Location;
  onTabScrollToNode: (node: BaseNode) => void;
  organization: Organization;
  /** The trace query searches around this time. */
  timestamp: number;
  tree?: TraceTree;
}

/**
 * Link target and click handler for a linked span. A plain click selects the span
 * if it is already in the tree (replays merge several traces into one tree).
 */
export function useLinkedSpanTarget({
  tree,
  link,
  timestamp,
  organization,
  location,
  onTabScrollToNode,
}: UseLinkedSpanTargetOptions) {
  const traceDispatch = useTraceStateDispatch();

  const to = generateLinkToEventInTraceView({
    organization,
    location,
    traceSlug: link.traceId,
    spanId: link.itemId,
    timestamp,
    tab: TraceLayoutTabKeys.WATERFALL,
  });

  function onClick(event: React.MouseEvent<HTMLAnchorElement>) {
    // Modified clicks (new tab, new window) go through the href.
    if (event.metaKey || event.altKey || event.ctrlKey || event.shiftKey) {
      return;
    }

    const spanNode = tree?.root.findChild(c => c.matchById(link.itemId));
    if (spanNode) {
      event.preventDefault();
      onTabScrollToNode(spanNode);
      return;
    }

    traceDispatch({type: 'minimize drawer', payload: true});
  }

  return {to, onClick};
}
