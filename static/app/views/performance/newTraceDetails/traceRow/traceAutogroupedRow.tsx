import {t} from 'sentry/locale';
import {TraceIcons} from 'sentry/views/performance/newTraceDetails/traceIcons';
import type {ParentAutogroupNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/parentAutogroupNode';
import type {SiblingAutogroupNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/siblingAutogroupNode';
import {AutogroupedTraceBar} from 'sentry/views/performance/newTraceDetails/traceRow/traceBar';
import {
  maybeFocusTraceRow,
  TRACE_COUNT_FORMATTER,
  TraceChildrenButton,
  TraceRowConnectors,
  type TraceRowProps,
} from 'sentry/views/performance/newTraceDetails/traceRow/traceRow';

export function TraceAutogroupedRow(
  props: TraceRowProps<ParentAutogroupNode | SiblingAutogroupNode>
) {
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
      className={`Autogrouped TraceRow ${props.rowSearchClassName} ${props.node.hasErrors ? props.node.maxIssueSeverity : ''}`}
      // oxlint-disable-next-line react/refs
      onPointerDown={props.onRowClick}
      // oxlint-disable-next-line react/refs
      onKeyDown={props.onRowKeyDown}
      // oxlint-disable-next-line react/refs
      style={props.style}
    >
      {/* oxlint-disable-next-line react/refs */}
      <div className="TraceLeftColumn" ref={props.registerListColumnRef}>
        <div
          className="TraceLeftColumnInner"
          // oxlint-disable-next-line react/refs
          style={props.listColumnStyle}
          // oxlint-disable-next-line react/refs
          onDoubleClick={props.onRowDoubleClick}
        >
          <div className="TraceChildrenCountWrapper">
            {/* oxlint-disable-next-line react/refs */}
            <TraceRowConnectors node={props.node} manager={props.manager} />
            <TraceChildrenButton
              icon={
                // oxlint-disable-next-line react/refs
                <TraceIcons.Chevron direction={props.node.expanded ? 'down' : 'right'} />
              }
              // oxlint-disable-next-line react/refs
              status={props.node.fetchStatus}
              // oxlint-disable-next-line react/refs
              expanded={!props.node.expanded}
              // oxlint-disable-next-line react/refs
              onClick={props.onExpand}
              // oxlint-disable-next-line react/refs
              onDoubleClick={props.onExpandDoubleClick}
            >
              {/* oxlint-disable-next-line react/refs */}
              {TRACE_COUNT_FORMATTER.format(props.node.groupCount)}
            </TraceChildrenButton>
          </div>

          <span className="TraceOperation">{t('Autogrouped')}</span>
          <strong className="TraceEmDash"> — </strong>
          {/* oxlint-disable-next-line react/refs */}
          <span className="TraceDescription">{props.node.value.autogrouped_by.op}</span>
        </div>
      </div>
      <div
        // oxlint-disable-next-line react/refs
        className={props.spanColumnClassName}
        // oxlint-disable-next-line react/refs
        ref={props.registerSpanColumnRef}
        // oxlint-disable-next-line react/refs
        onDoubleClick={props.onRowDoubleClick}
      >
        <AutogroupedTraceBar
          // oxlint-disable-next-line react/refs
          node={props.node}
          // oxlint-disable-next-line react/refs
          manager={props.manager}
          // oxlint-disable-next-line react/refs
          entire_space={props.node.space}
          // oxlint-disable-next-line react/refs
          errors={props.node.errors}
          // oxlint-disable-next-line react/refs
          virtualized_index={props.virtualized_index}
          // oxlint-disable-next-line react/refs
          color={props.node.makeBarColor(props.theme)}
          // oxlint-disable-next-line react/refs
          node_spaces={props.node.autogroupedSegments}
          // oxlint-disable-next-line react/refs
          occurrences={props.node.occurrences}
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
