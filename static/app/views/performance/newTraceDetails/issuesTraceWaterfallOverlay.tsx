import {useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
// eslint-disable-next-line no-restricted-imports
import color from 'color';
import type {LocationDescriptor} from 'history';
import * as qs from 'query-string';

import {generateTraceTarget} from 'sentry/components/quickTrace/utils';
import type {Event} from 'sentry/types/event';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {isCollapsedNode} from 'sentry/views/performance/newTraceDetails/traceGuards';
import {TraceViewSources} from 'sentry/views/performance/newTraceDetails/traceHeader/breadcrumbs';
import type {IssuesTraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/issuesTraceTree';
import {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';

import type {VirtualizedViewManager} from './traceRenderers/virtualizedViewManager';

interface RowPosition {
  height: number;
  left: number;
  pathToNode: TraceTree.NodePath[];
  top: number;
  width: number;
}

interface TraceOverlayProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  event: Event;
  groupId: string | undefined;
  tree: IssuesTraceTree;
  viewManager: VirtualizedViewManager;
}

/**
 * Renders a overlay over each row in the trace waterfall that blocks interaction with the row.
 * Instead, the overlay will link to the full trace view for the row.
 */
export function IssueTraceWaterfallOverlay({
  containerRef,
  event,
  groupId,
  tree,
  viewManager,
}: TraceOverlayProps) {
  const organization = useOrganization();
  const navigate = useNavigate();
  const [rowPositions, setRowPositions] = useState<RowPosition[] | null>(null);
  const location = useLocation();

  const traceTarget = useMemo(
    () =>
      generateTraceTarget(
        event,
        organization,
        {
          ...location,
          query: {
            ...location.query,
            ...(groupId ? {groupId} : {}),
          },
        },
        TraceViewSources.ISSUE_DETAILS
      ),
    [event, organization, location, groupId]
  );

  useEffect(() => {
    const measurePositions = () => {
      const container = containerRef.current;

      if (!container) {
        return;
      }

      const rows = container.querySelectorAll('.TraceRow:not(.Hidden)');
      const newPositions: RowPosition[] = [];
      const containerRect = container.getBoundingClientRect();

      // Rows should match the number of rows in the tree
      if (rows.length === 0 || rows.length !== tree.list.length) {
        setRowPositions(null);
        return;
      }

      rows.forEach((row, index) => {
        const node = tree.list[index];
        if (!node || isCollapsedNode(node)) {
          return;
        }

        const pathToNode = node.pathToNode();

        if (!pathToNode) {
          return;
        }

        const rect = row.getBoundingClientRect();
        newPositions.push({
          top: rect.top - containerRect.top,
          left: rect.left - containerRect.left,
          width: rect.width,
          height: rect.height,
          pathToNode,
        });
      });

      setRowPositions(newPositions);
    };

    viewManager.row_measurer.on('row measure end', measurePositions);
    return () => {
      viewManager.row_measurer.off('row measure end', measurePositions);
    };
  }, [viewManager, containerRef, tree]);

  // Link to an offender span in the trace view if the event includes an occurrence.
  // Keeps the highlighted span consistent across issues and trace waterfalls.
  const spanId = event.occurrence?.evidenceData?.offenderSpanIds?.[0];
  const baseNodePath: TraceTree.NodePath[] = spanId
    ? [`span-${spanId}`, `txn-${event.eventID}`]
    : [`txn-${event.eventID}`];
  const baseLink = getTraceLinkForIssue(traceTarget, baseNodePath);

  function handleLinkClick(
    clickEvent: React.MouseEvent<HTMLAnchorElement>,
    href: string
  ) {
    trackAnalytics('issue_details.view_full_trace_waterfall_clicked', {
      organization,
    });

    // Let the browser handle modified clicks (cmd/ctrl/shift/alt) and non-left
    // clicks (e.g. middle click to open in a new tab) natively. Only intercept a
    // plain left-click to perform SPA navigation.
    if (
      clickEvent.button !== 0 ||
      clickEvent.metaKey ||
      clickEvent.ctrlKey ||
      clickEvent.shiftKey ||
      clickEvent.altKey
    ) {
      return;
    }

    clickEvent.preventDefault();
    navigate(href);
  }

  return (
    <OverlayWrapper>
      <FallbackOverlayContainer
        href={baseLink}
        onClick={clickEvent => handleLinkClick(clickEvent, baseLink)}
        style={{inset: 0}}
      />
      {rowPositions?.map(pos => {
        const href = getTraceLinkForIssue(traceTarget, pos.pathToNode);
        return (
          <IssuesTraceOverlayContainer
            key={pos.pathToNode[0]}
            href={href}
            onClick={clickEvent => handleLinkClick(clickEvent, href)}
            style={{
              top: `${pos.top}px`,
              left: `${pos.left}px`,
              width: '100%',
              height: `${pos.height}px`,
            }}
          />
        );
      })}
    </OverlayWrapper>
  );
}

export function getTraceLinkForIssue(
  traceTarget: LocationDescriptor,
  pathToNode?: TraceTree.NodePath[]
) {
  if (typeof traceTarget === 'string') {
    return traceTarget;
  }

  const searchParams: Record<string, string | string[]> = {};
  for (const key in traceTarget.query) {
    if (defined(traceTarget.query[key])) {
      searchParams[key] = traceTarget.query[key];
    }
  }

  if (pathToNode) {
    // Override the node query param from traceTarget.query
    searchParams.node = pathToNode;
  }

  return `${traceTarget.pathname}?${qs.stringify(searchParams)}`;
}

const OverlayWrapper = styled('div')`
  position: absolute;
  inset: 0;
  z-index: 10;
  overflow: hidden;
`;

// These overlays are intentionally plain <a> elements rather than router
// <Link>s. On this surface (many absolutely-positioned links over the
// virtualized waterfall) router Links measured noticeably slower to hover,
// showing up as large browser layerization tasks; plain anchors keep the hover
// path cheap. Real hrefs are preserved and SPA navigation is handled in
// handleLinkClick.
const FallbackOverlayContainer = styled('a')`
  position: absolute;
  display: block;
  pointer-events: auto;
`;

const IssuesTraceOverlayContainer = styled('a')`
  position: absolute;
  display: block;
  pointer-events: auto;

  &:hover {
    background: ${p => color(p.theme.colors.gray400).alpha(0.1).toString()};
  }
`;
