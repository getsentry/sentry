import {Fragment} from 'react';

import {t} from 'sentry/locale';
import {
  isEAPTraceNode,
  isTraceNode,
} from 'sentry/views/performance/newTraceDetails/traceGuards';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {TraceTreeNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode';
import {
  maybeFocusTraceRow,
  TRACE_COUNT_FORMATTER,
  TraceChildrenButton,
  TraceRowConnectors,
  type TraceRowProps,
} from 'sentry/views/performance/newTraceDetails/traceRow/traceRow';

export function TraceRootRow(props: TraceRowProps<TraceTreeNode<TraceTree.Trace>>) {
  if (!isTraceNode(props.node) && !isEAPTraceNode(props.node)) {
    throw new Error('Trace row rendered called on row that is not root');
  }

  return (
    <div
      key={props.index}
      ref={r =>
        props.tabIndex === 0
          ? maybeFocusTraceRow(r, props.node, props.previouslyFocusedNodeRef)
          : undefined
      }
      tabIndex={props.tabIndex}
      className={`TraceRow ${props.rowSearchClassName} ${props.node.hasErrors ? props.node.maxIssueSeverity : ''}`}
      onPointerDown={props.onRowClick}
      onKeyDown={props.onRowKeyDown}
      style={props.style}
    >
      <div
        className="TraceLeftColumn"
        ref={props.registerListColumnRef}
        onDoubleClick={props.onRowDoubleClick}
      >
        <div className="TraceLeftColumnInner" style={props.listColumnStyle}>
          {' '}
          <div className="TraceChildrenCountWrapper Root">
            <TraceRowConnectors node={props.node} manager={props.manager} />
            {props.node.children.length > 0 || props.node.canFetch ? (
              <TraceChildrenButton
                icon={''}
                status={props.node.fetchStatus}
                expanded
                onClick={() => void 0}
                onDoubleClick={props.onExpandDoubleClick}
              >
                {props.node.fetchStatus === 'loading'
                  ? null
                  : props.node.children.length > 0
                    ? TRACE_COUNT_FORMATTER.format(props.node.children.length)
                    : null}
              </TraceChildrenButton>
            ) : null}
          </div>
          <span className="TraceOperation">{t('Trace')}</span>
          {props.trace_id ? (
            <Fragment>
              <strong className="TraceEmDash"> — </strong>
              <span className="TraceDescription">{props.trace_id}</span>
            </Fragment>
          ) : null}
        </div>
      </div>
      <div
        ref={props.registerSpanColumnRef}
        className={props.spanColumnClassName}
        onDoubleClick={props.onRowDoubleClick}
      />
    </div>
  );
}
