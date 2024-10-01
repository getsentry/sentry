import {Fragment} from 'react';
import type {Theme} from '@emotion/react';

import LoadingIndicator from 'sentry/components/loadingIndicator';
import type {PlatformKey} from 'sentry/types/project';
import {isParentAutogroupedNode} from 'sentry/views/performance/newTraceDetails/guards';
import type {VirtualizedViewManager} from 'sentry/views/performance/newTraceDetails/traceRenderers/virtualizedViewManager';

import {
  ParentAutogroupNode,
  type TraceTree,
  type TraceTreeNode,
} from '../traceModels/traceTree';

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
  isEmbedded: boolean;
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
  previouslyFocusedNodeRef: React.MutableRefObject<TraceTreeNode<TraceTree.NodeValue> | null>;
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
  node: TraceTreeNode<TraceTree.NodeValue>,
  previouslyFocusedNodeRef: React.MutableRefObject<TraceTreeNode<TraceTree.NodeValue> | null>
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
  node: TraceTreeNode<TraceTree.NodeValue>;
}) {
  const hasChildren =
    (props.node.expanded || props.node.zoomedIn) && props.node.children.length > 0;
  const showVerticalConnector =
    hasChildren || (props.node.value && isParentAutogroupedNode(props.node));

  // If the tail node of the collapsed node has no children,
  // we don't want to render the vertical connector as no children
  // are being rendered as the chain is entirely collapsed
  const hideVerticalConnector =
    showVerticalConnector &&
    props.node.value &&
    props.node instanceof ParentAutogroupNode &&
    (!props.node.tail.children.length ||
      (!props.node.tail.expanded && !props.node.expanded));

  return (
    <Fragment>
      {props.node.connectors.map((c, i) => {
        return (
          <span
            key={i}
            style={{
              left: -(
                Math.abs(Math.abs(c) - props.node.depth) * props.manager.row_depth_padding
              ),
            }}
            className={`TraceVerticalConnector ${c < 0 ? 'Orphaned' : ''}`}
          />
        );
      })}
      {showVerticalConnector && !hideVerticalConnector ? (
        <span className="TraceExpandedVerticalConnector" />
      ) : null}
      {props.node.isLastChild ? (
        <span className="TraceVerticalLastChildConnector" />
      ) : (
        <span className="TraceVerticalConnector" />
      )}
    </Fragment>
  );
}

export function TraceChildrenButton(props: {
  children: React.ReactNode;
  expanded: boolean;
  icon: React.ReactNode;
  onClick: (e: React.MouseEvent) => void;
  onDoubleClick: (e: React.MouseEvent) => void;
  status: TraceTreeNode<any>['fetchStatus'] | undefined;
}) {
  return (
    <button
      className={`TraceChildrenCount`}
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
