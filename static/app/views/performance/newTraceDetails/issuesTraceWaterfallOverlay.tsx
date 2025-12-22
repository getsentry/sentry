import {useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import Color from 'color';
import type {LocationDescriptor} from 'history';
import * as qs from 'query-string';

import {Link} from 'sentry/components/core/link';
import {generateTraceTarget} from 'sentry/components/quickTrace/utils';
import type {Event} from 'sentry/types/event';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
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

      const rows = document.querySelectorAll('.TraceRow:not(.Hidden)');
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

  const handleLinkClick = useCallback(() => {
    trackAnalytics('issue_details.view_full_trace_waterfall_clicked', {
      organization,
    });
  }, [organization]);

  // Link to an offender span in the trace view if the event includes an occurrence.
  // Keeps the highlighted span consistent across issues and trace waterfalls.
  const spanId = event.occurrence?.evidenceData?.offenderSpanIds?.[0];
  const baseNodePath: TraceTree.NodePath[] = spanId
    ? [`span-${spanId}`, `txn-${event.eventID}`]
    : [`txn-${event.eventID}`];
  const baseLink = getTraceLinkForIssue(traceTarget, baseNodePath);

  return (
    <OverlayWrapper>
      <FallbackOverlayContainer
        to={baseLink}
        onClick={handleLinkClick}
        style={{inset: 0}}
      />
      {rowPositions?.map(pos => (
        <IssuesTraceOverlayContainer
          key={pos.pathToNode[0]}
          to={getTraceLinkForIssue(traceTarget, pos.pathToNode)}
          onClick={handleLinkClick}
          style={{
            top: `${pos.top}px`,
            left: `${pos.left}px`,
            width: '100%',
            height: `${pos.height}px`,
          }}
        />
      ))}
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

const FallbackOverlayContainer = styled(Link)`
  position: absolute;
  display: block;
  pointer-events: auto;
`;

const IssuesTraceOverlayContainer = styled(Link)`
  position: absolute;
  display: block;
  pointer-events: auto;

  &:hover {
    background: ${p => Color(p.theme.colors.gray400).alpha(0.1).toString()};
  }
`;
