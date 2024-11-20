import {t} from 'sentry/locale';

import {TraceIcons} from '../traceIcons';
import type {ParentAutogroupNode} from '../traceModels/parentAutogroupNode';
import type {SiblingAutogroupNode} from '../traceModels/siblingAutogroupNode';
import {AutogroupedTraceBar, makeTraceNodeBarColor} from '../traceRow/traceBar';
import {
  maybeFocusTraceRow,
  TRACE_COUNT_FORMATTER,
  TraceChildrenButton,
  TraceRowConnectors,
  type TraceRowProps,
} from '../traceRow/traceRow';

export function TraceAutogroupedRow(
  props: TraceRowProps<ParentAutogroupNode | SiblingAutogroupNode>
) {
  return (
    <div
      key={props.index}
      ref={r =>
        props.tabIndex === 0
          ? maybeFocusTraceRow(r, props.node, props.previouslyFocusedNodeRef)
          : null
      }
      tabIndex={props.tabIndex}
      className={`Autogrouped TraceRow ${props.rowSearchClassName} ${props.node.hasErrors ? props.node.maxIssueSeverity : ''}`}
      onPointerDown={props.onRowClick}
      onKeyDown={props.onRowKeyDown}
      style={props.style}
    >
      <div className="TraceLeftColumn" ref={props.registerListColumnRef}>
        <div
          className="TraceLeftColumnInner"
          style={props.listColumnStyle}
          onDoubleClick={props.onRowDoubleClick}
        >
          <div className="TraceChildrenCountWrapper">
            <TraceRowConnectors node={props.node} manager={props.manager} />
            <TraceChildrenButton
              icon={
                <TraceIcons.Chevron direction={props.node.expanded ? 'up' : 'down'} />
              }
              status={props.node.fetchStatus}
              expanded={!props.node.expanded}
              onClick={props.onExpand}
              onDoubleClick={props.onExpandDoubleClick}
            >
              {TRACE_COUNT_FORMATTER.format(props.node.groupCount)}
            </TraceChildrenButton>
          </div>

          <span className="TraceOperation">{t('Autogrouped')}</span>
          <strong className="TraceEmDash"> — </strong>
          <span className="TraceDescription">{props.node.value.autogrouped_by.op}</span>
        </div>
      </div>
      <div
        className={props.spanColumnClassName}
        ref={props.registerSpanColumnRef}
        onDoubleClick={props.onRowDoubleClick}
      >
        <AutogroupedTraceBar
          node={props.node}
          manager={props.manager}
          entire_space={props.node.space}
          errors={props.node.errors}
          virtualized_index={props.virtualized_index}
          color={makeTraceNodeBarColor(props.theme, props.node)}
          node_spaces={props.node.autogroupedSegments}
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
