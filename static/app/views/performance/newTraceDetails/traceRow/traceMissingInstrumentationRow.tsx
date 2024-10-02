import {t} from 'sentry/locale';
import {TraceIcons} from 'sentry/views/performance/newTraceDetails/icons';
import {
  makeTraceNodeBarColor,
  type TraceTree,
  type TraceTreeNode,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {MissingInstrumentationTraceBar} from 'sentry/views/performance/newTraceDetails/traceRow/traceBar';
import {
  maybeFocusTraceRow,
  TraceRowConnectors,
  type TraceRowProps,
} from 'sentry/views/performance/newTraceDetails/traceRow/traceRow';

export function TraceMissingInstrumentationRow(
  props: TraceRowProps<TraceTreeNode<TraceTree.MissingInstrumentationSpan>>
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
      className={`TraceRow ${props.rowSearchClassName}`}
      onClick={props.onRowClick}
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
          </div>
          <span className="TraceOperation">{t('Missing instrumentation')}</span>
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
          color={makeTraceNodeBarColor(props.theme, props.node)}
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
