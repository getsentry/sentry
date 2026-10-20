import {Fragment} from 'react';

import {t} from 'sentry/locale';
import type {TraceNode} from 'sentry/views/performance/traceDetails/traceModels/traceTreeNode/traceNode';
import {
  maybeFocusTraceRow,
  TRACE_COUNT_FORMATTER,
  TraceChildrenButton,
  TraceRowConnectors,
  type TraceRowProps,
} from 'sentry/views/performance/traceDetails/traceRow/traceRow';

export function TraceRootRow(props: TraceRowProps<TraceNode>) {
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
        // oxlint-disable-next-line react/refs
        onDoubleClick={props.onRowDoubleClick}
      >
        <div className="TraceLeftColumnInner" style={props.listColumnStyle}>
          {' '}
          <div className="TraceChildrenCountWrapper Root">
            <TraceRowConnectors node={props.node} manager={props.manager} />
            {props.node.children.length > 0 || props.node.fetchStatus === 'loading' ? (
              <TraceChildrenButton
                icon=""
                status={props.node.fetchStatus}
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
      {props.pinnedAttributeCell}
      <div
        ref={props.registerSpanColumnRef}
        className={props.spanColumnClassName}
        onDoubleClick={props.onRowDoubleClick}
      />
    </div>
  );
}
