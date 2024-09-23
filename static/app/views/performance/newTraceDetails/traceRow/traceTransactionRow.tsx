import {PlatformIcon} from 'platformicons';

import {TraceIcons} from 'sentry/views/performance/newTraceDetails/icons';
import {
  makeTraceNodeBarColor,
  type TraceTree,
  type TraceTreeNode,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {TraceBar} from 'sentry/views/performance/newTraceDetails/traceRow/traceBar';
import {
  maybeFocusTraceRow,
  TRACE_COUNT_FORMATTER,
  TraceChildrenButton,
  TraceRowConnectors,
  type TraceRowProps,
} from 'sentry/views/performance/newTraceDetails/traceRow/traceRow';

export function TraceTransactionRow(
  props: TraceRowProps<TraceTreeNode<TraceTree.Transaction>>
) {
  return (
    <div
      key={props.index}
      ref={r =>
        props.tabIndex === 0 && !props.isEmbedded
          ? maybeFocusTraceRow(r, props.node, props.previouslyFocusedNodeRef)
          : null
      }
      tabIndex={props.tabIndex}
      className={`TraceRow ${props.rowSearchClassName} ${props.node.has_errors ? props.node.max_severity : ''}`}
      onKeyDown={props.onRowKeyDown}
      onClick={props.onRowClick}
      style={props.style}
    >
      <div className="TraceLeftColumn" ref={props.registerListColumnRef}>
        <div
          className="TraceLeftColumnInner"
          style={props.listColumnStyle}
          onDoubleClick={props.onRowDoubleClick}
        >
          <div className={props.listColumnClassName}>
            <TraceRowConnectors node={props.node} manager={props.manager} />
            {props.node.children.length > 0 || props.node.canFetch ? (
              <TraceChildrenButton
                icon={
                  props.node.canFetch ? (
                    props.node.fetchStatus === 'idle' ? (
                      '+'
                    ) : props.node.zoomedIn ? (
                      <TraceIcons.Chevron direction="up" />
                    ) : (
                      '+'
                    )
                  ) : (
                    <TraceIcons.Chevron direction={props.node.expanded ? 'up' : 'down'} />
                  )
                }
                status={props.node.fetchStatus}
                expanded={props.node.expanded || props.node.zoomedIn}
                onDoubleClick={props.onExpandDoubleClick}
                onClick={e => {
                  props.node.canFetch ? props.onZoomIn(e) : props.onExpand(e);
                }}
              >
                {props.node.children.length > 0
                  ? TRACE_COUNT_FORMATTER.format(props.node.children.length)
                  : null}
              </TraceChildrenButton>
            ) : null}
          </div>
          <PlatformIcon
            platform={props.projects[props.node.value.project_slug] ?? 'default'}
          />
          <span className="TraceOperation">{props.node.value['transaction.op']}</span>
          <strong className="TraceEmDash"> — </strong>
          <span>{props.node.value.transaction}</span>
        </div>
      </div>
      <div
        ref={props.registerSpanColumnRef}
        className={props.spanColumnClassName}
        onDoubleClick={props.onRowDoubleClick}
      >
        <TraceBar
          virtualized_index={props.virtualized_index}
          manager={props.manager}
          color={makeTraceNodeBarColor(props.theme, props.node)}
          node_space={props.node.space}
          errors={props.node.errors}
          performance_issues={props.node.performance_issues}
          profiles={props.node.profiles}
        />
        <button
          ref={props.registerSpanArrowRef}
          className="TraceArrow"
          onClick={props.onSpanArrowClick}
        >
          <TraceIcons.Chevron direction="left" />
        </button>
      </div>
    </div>
  );
}
