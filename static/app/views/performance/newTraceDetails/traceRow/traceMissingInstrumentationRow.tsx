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
      // oxlint-disable-next-line react/refs
      key={props.index}
      ref={r =>
        props.tabIndex === 0
          ? maybeFocusTraceRow(r, props.node, props.previouslyFocusedNodeRef)
          : undefined
      }
      // oxlint-disable-next-line react/refs
      tabIndex={props.tabIndex}
      className={`TraceRow ${props.rowSearchClassName}`}
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
          <div className="TraceChildrenCountWrapper">
            {/* oxlint-disable-next-line react/refs */}
            <TraceRowConnectors node={props.node} manager={props.manager} />
          </div>
          <span className="TraceOperation">{t('No Instrumentation')}</span>
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
        <MissingInstrumentationTraceBar
          // oxlint-disable-next-line react/refs
          virtualized_index={props.virtualized_index}
          // oxlint-disable-next-line react/refs
          manager={props.manager}
          // oxlint-disable-next-line react/refs
          color={props.node.makeBarColor(props.theme)}
          // oxlint-disable-next-line react/refs
          node_space={props.node.space}
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
