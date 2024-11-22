import {useMemo} from 'react';

import {t} from 'sentry/locale';
import {isTraceErrorNode} from 'sentry/views/performance/newTraceDetails/traceGuards';

import type {CollapsedNode} from '../traceModels/traceCollapsedNode';
import {TraceTree} from '../traceModels/traceTree';
import type {TraceRowProps} from '../traceRow/traceRow';

export function TraceCollapsedRow(props: TraceRowProps<CollapsedNode>) {
  const collapsedNodeType = useMemo(() => {
    let type: 'issues only' | '' = 'issues only';
    let count = 1;

    TraceTree.ForEachChild(props.node, c => {
      count++;
      if (!isTraceErrorNode(c)) {
        type = '';
      }
    });
    return {count, type};
  }, [props.node]);

  return (
    <div
      key={props.index}
      tabIndex={props.tabIndex}
      className={`Collapsed ${collapsedNodeType.type === 'issues only' ? 'IssuesOnly' : ''} TraceRow`}
      onPointerDown={props.onRowClick}
      onKeyDown={props.onRowKeyDown}
      style={props.style}
    >
      <div className="TraceLeftColumn" ref={props.registerListColumnRef}>
        <div className="TraceLeftColumnInner" style={props.listColumnStyle}>
          {collapsedNodeType.count}{' '}
          {collapsedNodeType.count === 1 ? t('hidden span') : t('hidden spans')}
        </div>
      </div>
    </div>
  );
}
