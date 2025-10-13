import {t} from 'sentry/locale';
import {TraceIcons} from 'sentry/views/performance/newTraceDetails/traceIcons';
import type {NoInstrumentationNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/noInstrumentationNode';
import {MissingInstrumentationTraceBar} from 'sentry/views/performance/newTraceDetails/traceRow/traceBar';
import {
  maybeFocusTraceRow,
  TraceRowConnectors,
  type TraceRowProps,
} from 'sentry/views/performance/newTraceDetails/traceRow/traceRow';

export function TraceMissingInstrumentationRow(
  props: TraceRowProps<NoInstrumentationNode>
) {
  return (
    <div
      key={props.index}
      ref={r =>
        props.tabIndex === 0
          ? maybeFocusTraceRow(r, props.node, props.previouslyFocusedNodeRef)
          : undefined
      }
      tabIndex={props.tabIndex}
      className={`TraceRow ${props.rowSearchClassName}`}
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
          <div className="TraceChildrenCountWrapper">
            <TraceRowConnectors node={props.node} manager={props.manager} />
          </div>
          <span className="TraceOperation">{t('No Instrumentation')}</span>
        </div>
      </div>
      <div
        ref={props.registerSpanColumnRef}
        className={props.spanColumnClassName}
        onDoubleClick={props.onRowDoubleClick}
      >
        <MissingInstrumentationTraceBar
          virtualized_index={props.virtualized_index}
          manager={props.manager}
          color={props.node.makeBarColor(props.theme)}
          node_space={props.node.space}
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
