import {Fragment} from 'react';

import {t} from 'sentry/locale';
import type {TraceNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/traceNode';
import {
  maybeFocusTraceRow,
  TRACE_COUNT_FORMATTER,
  TraceChildrenButton,
  TraceRowConnectors,
  type TraceRowProps,
} from 'sentry/views/performance/newTraceDetails/traceRow/traceRow';

export function TraceRootRow(props: TraceRowProps<TraceNode>) {
  return (
    <div
      // oxlint-disable-next-line react/refs
      key={props.index}
      ref={r =>
        props.tabIndex === 0
          ? maybeFocusTraceRow(r, props.node, props.previouslyFocusedNodeRef)
          : undefined
      }
      // oxlint-disable-next-line react/refs
      tabIndex={props.tabIndex}
      className={`TraceRow ${props.rowSearchClassName} ${props.node.hasErrors ? props.node.maxIssueSeverity : ''}`}
      // oxlint-disable-next-line react/refs
      onPointerDown={props.onRowClick}
      // oxlint-disable-next-line react/refs
      onKeyDown={props.onRowKeyDown}
      // oxlint-disable-next-line react/refs
      style={props.style}
    >
      <div
        className="TraceLeftColumn"
        // oxlint-disable-next-line react/refs
        ref={props.registerListColumnRef}
        // oxlint-disable-next-line react/refs
        onDoubleClick={props.onRowDoubleClick}
      >
        {/* oxlint-disable-next-line react/refs */}
        <div className="TraceLeftColumnInner" style={props.listColumnStyle}>
          {' '}
          <div className="TraceChildrenCountWrapper Root">
            {/* oxlint-disable-next-line react/refs */}
            <TraceRowConnectors node={props.node} manager={props.manager} />
            {/* oxlint-disable-next-line react/refs */}
            {props.node.children.length > 0 || props.node.canFetchChildren ? (
              <TraceChildrenButton
                icon=""
                // oxlint-disable-next-line react/refs
                status={props.node.fetchStatus}
                expanded
                onClick={() => void 0}
                // oxlint-disable-next-line react/refs
                onDoubleClick={props.onExpandDoubleClick}
              >
                {/* oxlint-disable-next-line react/refs */}
                {props.node.fetchStatus === 'loading'
                  ? null
                  : // oxlint-disable-next-line react/refs
                    props.node.children.length > 0
                    ? // oxlint-disable-next-line react/refs
                      TRACE_COUNT_FORMATTER.format(props.node.children.length)
                    : null}
              </TraceChildrenButton>
            ) : null}
          </div>
          <span className="TraceOperation">{t('Trace')}</span>
          {/* oxlint-disable-next-line react/refs */}
          {props.trace_id ? (
            <Fragment>
              <strong className="TraceEmDash"> — </strong>
              {/* oxlint-disable-next-line react/refs */}
              <span className="TraceDescription">{props.trace_id}</span>
            </Fragment>
          ) : null}
        </div>
      </div>
      <div
        // oxlint-disable-next-line react/refs
        ref={props.registerSpanColumnRef}
        // oxlint-disable-next-line react/refs
        className={props.spanColumnClassName}
        // oxlint-disable-next-line react/refs
        onDoubleClick={props.onRowDoubleClick}
      />
    </div>
  );
}
