import {Fragment} from 'react';

import {t} from 'sentry/locale';

import {isTraceNode} from '../traceGuards';
import {TraceIcons} from '../traceIcons';
import type {TraceTree} from '../traceModels/traceTree';
import type {TraceTreeNode} from '../traceModels/traceTreeNode';
import {makeTraceNodeBarColor, TraceBar} from '../traceRow/traceBar';
import {
  maybeFocusTraceRow,
  TRACE_COUNT_FORMATTER,
  TraceChildrenButton,
  TraceRowConnectors,
  type TraceRowProps,
} from '../traceRow/traceRow';
import {useHasTraceNewUi} from '../useHasTraceNewUi';

const NO_ERRORS = new Set<TraceTree.TraceError>();
const NO_PERFORMANCE_ISSUES = new Set<TraceTree.TracePerformanceIssue>();
const NO_PROFILES = [];

export function TraceRootRow(props: TraceRowProps<TraceTreeNode<TraceTree.Trace>>) {
  const hasTraceNewUi = useHasTraceNewUi();

  if (!isTraceNode(props.node)) {
    throw new Error('Trace row rendered called on row that is not root');
  }

  return (
    <div
      key={props.index}
      ref={r =>
        props.tabIndex === 0
          ? maybeFocusTraceRow(r, props.node, props.previouslyFocusedNodeRef)
          : null
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
      >
        {!hasTraceNewUi && (
          <Fragment>
            <TraceBar
              node={props.node}
              virtualized_index={props.virtualized_index}
              manager={props.manager}
              color={makeTraceNodeBarColor(props.theme, props.node)}
              node_space={props.node.space}
              errors={NO_ERRORS}
              performance_issues={NO_PERFORMANCE_ISSUES}
              profiles={NO_PROFILES}
            />
            <button
              ref={props.registerSpanArrowRef}
              className="TraceArrow"
              onClick={props.onSpanArrowClick}
            >
              <TraceIcons.Chevron direction="left" />
            </button>
          </Fragment>
        )}
      </div>
    </div>
  );
}
