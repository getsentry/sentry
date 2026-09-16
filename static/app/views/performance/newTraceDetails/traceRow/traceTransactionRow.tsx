import {Fragment} from 'react';
import {PlatformIcon} from 'platformicons';

import {TraceIcons} from 'sentry/views/performance/newTraceDetails/traceIcons';
import type {TransactionNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/transactionNode';
import {TraceBar} from 'sentry/views/performance/newTraceDetails/traceRow/traceBar';
import {
  maybeFocusTraceRow,
  TRACE_COUNT_FORMATTER,
  TraceChildrenButton,
  TraceRowConnectors,
  type TraceRowProps,
} from 'sentry/views/performance/newTraceDetails/traceRow/traceRow';

export function TraceTransactionRow(props: TraceRowProps<TransactionNode>) {
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
      onKeyDown={props.onRowKeyDown}
      // oxlint-disable-next-line react/refs
      onPointerDown={props.onRowClick}
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
          {/* oxlint-disable-next-line react/refs */}
          <div className={props.listColumnClassName}>
            {/* oxlint-disable-next-line react/refs */}
            <TraceRowConnectors node={props.node} manager={props.manager} />
            {/* oxlint-disable-next-line react/refs */}
            {props.node.children.length > 0 || props.node.canFetchChildren ? (
              <TraceChildrenButton
                icon={
                  // oxlint-disable-next-line react/refs
                  props.node.canFetchChildren ? (
                    // oxlint-disable-next-line react/refs
                    props.node.fetchStatus === 'idle' ? (
                      '+' // oxlint-disable-next-line react/refs
                    ) : props.node.hasFetchedChildren ? (
                      <TraceIcons.Chevron direction="down" />
                    ) : (
                      '+'
                    )
                  ) : (
                    <TraceIcons.Chevron
                      // oxlint-disable-next-line react/refs
                      direction={props.node.expanded ? 'down' : 'right'}
                    />
                  )
                }
                // oxlint-disable-next-line react/refs
                status={props.node.fetchStatus}
                // oxlint-disable-next-line react/refs
                expanded={props.node.expanded || props.node.hasFetchedChildren}
                // oxlint-disable-next-line react/refs
                onDoubleClick={props.onExpandDoubleClick}
                onClick={e => {
                  if (props.node.canFetchChildren) {
                    props.onZoomIn(e);
                  } else {
                    props.onExpand(e);
                  }
                }}
              >
                {/* oxlint-disable-next-line react/refs */}
                {props.node.children.length > 0
                  ? // oxlint-disable-next-line react/refs
                    TRACE_COUNT_FORMATTER.format(props.node.children.length)
                  : null}
              </TraceChildrenButton>
            ) : null}
          </div>
          <PlatformIcon
            // oxlint-disable-next-line react/refs
            platform={props.projects[props.node.value.project_slug] ?? 'default'}
          />
          {props.node.value['transaction.op'] !== 'default' && (
            <Fragment>
              <span className="TraceOperation">{props.node.value['transaction.op']}</span>
              <strong className="TraceEmDash"> — </strong>
            </Fragment>
          )}
          {/* oxlint-disable-next-line react/refs */}
          <span className="TraceDescription">{props.node.value.transaction}</span>
        </div>
      </div>
      <div
        // oxlint-disable-next-line react/refs
        ref={props.registerSpanColumnRef}
        // oxlint-disable-next-line react/refs
        className={props.spanColumnClassName}
        // oxlint-disable-next-line react/refs
        onDoubleClick={props.onRowDoubleClick}
      >
        <TraceBar
          // oxlint-disable-next-line react/refs
          node={props.node}
          // oxlint-disable-next-line react/refs
          virtualized_index={props.virtualized_index}
          // oxlint-disable-next-line react/refs
          manager={props.manager}
          // oxlint-disable-next-line react/refs
          color={props.node.makeBarColor(props.theme)}
          // oxlint-disable-next-line react/refs
          node_space={props.node.space}
          // oxlint-disable-next-line react/refs
          errors={props.node.errors}
          // oxlint-disable-next-line react/refs
          occurrences={props.node.occurrences}
          // Since transactions have ms precision, we show 2 decimal places only if the duration is greater than 1 second.
          // oxlint-disable-next-line react/refs
          durationPrecision={props.node.space[1] >= 1000 ? 2 : 0}
        />
        <button
          // oxlint-disable-next-line react/refs
          ref={props.registerSpanArrowRef}
          className="TraceArrow"
          // oxlint-disable-next-line react/refs
          onClick={props.onSpanArrowClick}
        >
          <TraceIcons.Chevron direction="left" />
        </button>
      </div>
    </div>
  );
}
