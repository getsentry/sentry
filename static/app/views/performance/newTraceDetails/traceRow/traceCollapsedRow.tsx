import {useMemo} from 'react';

import {t} from 'sentry/locale';

import type {CollapsedNode} from '../traceModels/traceCollapsedNode';
import {TraceTree} from '../traceModels/traceTree';
import type {TraceRowProps} from '../traceRow/traceRow';

export function TraceCollapsedRow(props: TraceRowProps<CollapsedNode>) {
  const collapsedChildrenCount = useMemo(() => {
    let count = 1;
    TraceTree.ForEachChild(props.node, () => count++);
    return count;
  }, [props.node]);

  return (
    <div
      key={props.index}
      tabIndex={props.tabIndex}
      className="Collapsed TraceRow"
      onPointerDown={props.onRowClick}
      onKeyDown={props.onRowKeyDown}
      style={props.style}
    >
      <div className="TraceLeftColumn" ref={props.registerListColumnRef}>
        <div className="TraceLeftColumnInner" style={props.listColumnStyle}>
          {collapsedChildrenCount}{' '}
          {collapsedChildrenCount === 1 ? t('hidden span') : t('hidden spans')}
        </div>
      </div>
    </div>
  );
}
