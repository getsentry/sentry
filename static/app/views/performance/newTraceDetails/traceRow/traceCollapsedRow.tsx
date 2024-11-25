import {useMemo} from 'react';

import {t} from 'sentry/locale';
import {
  isCollapsedNode,
  isTraceErrorNode,
} from 'sentry/views/performance/newTraceDetails/traceGuards';

import type {CollapsedNode} from '../traceModels/traceCollapsedNode';
import {TraceTree} from '../traceModels/traceTree';
import type {TraceRowProps} from '../traceRow/traceRow';

export function TraceCollapsedRow(props: TraceRowProps<CollapsedNode>) {
  const stats = useMemo(() => {
    const childStatistics = {issues: 0, events: 0};

    TraceTree.ForEachChild(props.node, c => {
      // Dont count collapsed nodes
      if (isCollapsedNode(c)) {
        return;
      }

      if (!isTraceErrorNode(c)) {
        childStatistics.events++;
      } else {
        childStatistics.issues++;
      }
    });
    return childStatistics;
  }, [props.node]);

  return (
    <div
      key={props.index}
      tabIndex={props.tabIndex}
      className={`Collapsed TraceRow`}
      onPointerDown={props.onRowClick}
      onKeyDown={props.onRowKeyDown}
      style={props.style}
    >
      <div className="TraceLeftColumn" ref={props.registerListColumnRef}>
        <div className="TraceLeftColumnInner" style={props.listColumnStyle}>
          {stats.issues + stats.events}{' '}
          {stats.events > 0
            ? stats.events === 1
              ? t('hidden span')
              : t('hidden spans')
            : null}
          {stats.issues > 0
            ? stats.issues === 1
              ? t('hidden issue')
              : t('hidden issues')
            : null}
        </div>
      </div>
    </div>
  );
}
