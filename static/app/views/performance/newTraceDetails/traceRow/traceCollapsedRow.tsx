import {useMemo} from 'react';

import {t} from 'sentry/locale';
import {
  isCollapsedNode,
  isTraceErrorNode,
} from 'sentry/views/performance/newTraceDetails/traceGuards';
import type {CollapsedNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceCollapsedNode';
import {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {TraceTreeNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode';
import type {TraceRowProps} from 'sentry/views/performance/newTraceDetails/traceRow/traceRow';

export function TraceCollapsedRow(props: TraceRowProps<CollapsedNode>) {
  const stats = useMemo(() => {
    const childStatistics = {issues: 0, events: 0};

    const seen = new Set<TraceTreeNode<any>>();

    TraceTree.ForEachChild(props.node, c => {
      // Dont count collapsed nodes and track what we've seen because
      // the collapsed nodes may contain duplicate children due to vertical
      // collapsing.
      if (isCollapsedNode(c) || seen.has(c)) {
        return;
      }

      seen.add(c);

      if (isTraceErrorNode(c)) {
        childStatistics.issues++;
      } else {
        childStatistics.events++;
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
          {stats.events > 0 ? stats.events : null}{' '}
          {stats.events > 0
            ? stats.events === 1
              ? t('hidden span')
              : t('hidden spans')
            : null}
          {stats.issues > 0 && stats.events > 0 && ', '}
          {stats.issues > 0 ? stats.issues : null}{' '}
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
