import {Fragment} from 'react';
import type {Theme} from '@emotion/react';

import LoadingIndicator from 'sentry/components/loadingIndicator';
import type {PlatformKey} from 'sentry/types/project';
import {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {BaseNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/baseNode';
import type {VirtualizedViewManager} from 'sentry/views/performance/newTraceDetails/traceRenderers/virtualizedViewManager';

export const TRACE_COUNT_FORMATTER = Intl.NumberFormat(undefined, {notation: 'compact'});

export const TRACE_RIGHT_COLUMN_EVEN_CLASSNAME = `TraceRightColumn`;
export const TRACE_RIGHT_COLUMN_ODD_CLASSNAME = [
  TRACE_RIGHT_COLUMN_EVEN_CLASSNAME,
  'Odd',
].join(' ');
export const TRACE_CHILDREN_COUNT_WRAPPER_CLASSNAME = `TraceChildrenCountWrapper`;
export const TRACE_CHILDREN_COUNT_WRAPPER_ORPHANED_CLASSNAME = [
  TRACE_CHILDREN_COUNT_WRAPPER_CLASSNAME,
  'Orphaned',
].join(' ');

export interface TraceRowProps<T extends TraceTree.Node> {
  index: number;
  listColumnClassName: string;
  listColumnStyle: React.CSSProperties;
  manager: VirtualizedViewManager;
  node: T;
  onExpand: (e: React.MouseEvent) => void;
  onExpandDoubleClick: (e: React.MouseEvent) => void;
  onRowClick: (e: React.MouseEvent<HTMLElement>) => void;
  onRowDoubleClick: (e: React.MouseEvent) => void;
  onRowKeyDown: (e: React.KeyboardEvent) => void;
  onSpanArrowClick: (e: React.MouseEvent) => void;
  onZoomIn: (e: React.MouseEvent) => void;
  previouslyFocusedNodeRef: React.MutableRefObject<BaseNode | null>;
  projects: Record<string, PlatformKey | undefined>;
  registerListColumnRef: (e: HTMLDivElement | null) => void;
  registerSpanArrowRef: (e: HTMLButtonElement | null) => void;
  registerSpanColumnRef: (e: HTMLDivElement | null) => void;
  rowSearchClassName: string;
  spanColumnClassName: string;
  style: React.CSSProperties;
  tabIndex: number;
  theme: Theme;
  trace_id: string | undefined;
  virtualized_index: number;
}

export function maybeFocusTraceRow(
  ref: HTMLDivElement | null,
  node: BaseNode,
  previouslyFocusedNodeRef: React.MutableRefObject<BaseNode | null>
) {
  if (!ref) {
    return;
  }
  if (node === previouslyFocusedNodeRef.current) {
    return;
  }

  previouslyFocusedNodeRef.current = node;
  ref.focus();
}

export function TraceRowConnectors(props: {
  manager: VirtualizedViewManager;
  node: BaseNode;
}) {
  const hasChildren = props.node.hasVisibleChildren();
  const nodeDepth = TraceTree.Depth(props.node);

  return (
    <Fragment>
      {TraceTree.ConnectorsTo(props.node).map((c, i) => {
        return (
          <span
            key={i}
            style={{
              left: -(
                Math.abs(Math.abs(c) - nodeDepth) * props.manager.row_depth_padding
              ),
            }}
            className={`TraceVerticalConnector ${c <= 0 ? 'Orphaned' : ''}`}
          />
        );
      })}
      {hasChildren ? <span className="TraceExpandedVerticalConnector" /> : null}
      {props.node.isLastChild() ? (
        <span className="TraceVerticalLastChildConnector" />
      ) : null}
    </Fragment>
  );
}

export function TraceChildrenButton(props: {
  children: React.ReactNode;
  expanded: boolean;
  icon: React.ReactNode;
  onClick: (e: React.MouseEvent) => void;
  onDoubleClick: (e: React.MouseEvent) => void;
  status: BaseNode['fetchStatus'] | undefined;
}) {
  return (
    <button
      className="TraceChildrenCount"
      onClick={props.onClick}
      onDoubleClick={props.onDoubleClick}
    >
      <div className="TraceChildrenCountContent">{props.children}</div>
      <div className="TraceChildrenCountAction">
        {props.icon}
        {props.status === 'loading' ? (
          <LoadingIndicator className="TraceActionsLoadingIndicator" size={8} />
        ) : null}
      </div>
    </button>
  );
}
