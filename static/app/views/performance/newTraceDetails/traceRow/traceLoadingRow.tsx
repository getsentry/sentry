import type {Theme} from '@emotion/react';

import Placeholder from 'sentry/components/placeholder';
import {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {BaseNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/baseNode';
import type {VirtualizedViewManager} from 'sentry/views/performance/newTraceDetails/traceRenderers/virtualizedViewManager';
import {
  TRACE_COUNT_FORMATTER,
  TRACE_RIGHT_COLUMN_EVEN_CLASSNAME,
  TRACE_RIGHT_COLUMN_ODD_CLASSNAME,
  TraceChildrenButton,
  TraceRowConnectors,
} from 'sentry/views/performance/newTraceDetails/traceRow/traceRow';

function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

export function TraceLoadingRow(props: {
  index: number;
  manager: VirtualizedViewManager;
  node: BaseNode;
  style: React.CSSProperties;
  theme: Theme;
}) {
  return (
    <div
      key={props.index}
      className="TraceRow"
      style={{
        transform: props.style.transform,
        height: props.style.height,
        pointerEvents: 'none',
        color: props.theme.tokens.content.secondary,
        paddingLeft: 8,
      }}
    >
      <div
        className="TraceLeftColumn"
        style={{width: props.manager.columns.list.width * 100 + '%'}}
      >
        <div
          className="TraceLeftColumnInner"
          style={{
            paddingLeft: TraceTree.Depth(props.node) * props.manager.row_depth_padding,
          }}
        >
          <div
            className={`TraceChildrenCountWrapper ${props.node.isRootNodeChild() ? 'Root' : ''}`}
          >
            <TraceRowConnectors node={props.node} manager={props.manager} />
            {props.node.children.length > 0 || props.node.canFetchChildren ? (
              <TraceChildrenButton
                icon="+"
                status={props.node.fetchStatus}
                expanded={props.node.expanded || props.node.hasFetchedChildren}
                onClick={() => void 0}
                onDoubleClick={() => void 0}
              >
                {props.node.children.length > 0
                  ? TRACE_COUNT_FORMATTER.format(props.node.children.length)
                  : null}
              </TraceChildrenButton>
            ) : null}
          </div>
          <Placeholder
            className="Placeholder"
            height="12px"
            width={randomBetween(20, 80) + '%'}
            style={{
              transition: 'all 30s ease-out',
            }}
          />
        </div>
      </div>
      <div
        className={
          props.index % 2 === 1
            ? TRACE_RIGHT_COLUMN_ODD_CLASSNAME
            : TRACE_RIGHT_COLUMN_EVEN_CLASSNAME
        }
        style={{
          width: props.manager.columns.span_list.width * 100 + '%',
        }}
      >
        <Placeholder
          className="Placeholder"
          height="12px"
          width={randomBetween(20, 80) + '%'}
          style={{
            transition: 'all 30s ease-out',
            transform: `translate(${randomBetween(0, 200) + 'px'}, 0)`,
          }}
        />
      </div>
    </div>
  );
}
