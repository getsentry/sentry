/** @knipignore */

import {uuid4} from '@sentry/core';

import type {TraceTreeNodeDetailsProps} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceTreeNodeDetails';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {TraceTreeNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode';
import {TraceCollapsedRow} from 'sentry/views/performance/newTraceDetails/traceRow/traceCollapsedRow';
import type {TraceRowProps} from 'sentry/views/performance/newTraceDetails/traceRow/traceRow';

import {BaseNode, type TraceTreeNodeExtra} from './baseNode';

export class CollapsedNode extends BaseNode<TraceTree.CollapsedNode> {
  readonly expanded: boolean = false;

  constructor(
    parent: BaseNode,
    value: TraceTree.CollapsedNode,
    extra: TraceTreeNodeExtra | null
  ) {
    super(parent, value, extra);
    this.canShowDetails = false;

    this.parent?.children.push(this);
  }

  get type(): TraceTree.NodeType {
    return 'collapsed';
  }

  get drawerTabsTitle(): string {
    return 'Collapsed';
  }

  get traceHeaderTitle(): {title: string; subtitle?: string} {
    return {title: 'Collapsed'};
  }

  get id(): string {
    return uuid4();
  }

  printNode(): string {
    return 'collapsed';
  }

  matchByPath(_path: TraceTree.NodePath): boolean {
    return false;
  }

  analyticsName(): string {
    return 'collapsed';
  }

  renderWaterfallRow<NodeType extends TraceTree.Node = TraceTree.Node>(
    props: TraceRowProps<NodeType>
  ): React.ReactNode {
    // @ts-expect-error Abdullah Khan: Will be fixed as BaseNode is used in TraceTree
    return <TraceCollapsedRow {...props} node={props.node} />;
  }

  renderDetails<NodeType extends TraceTreeNode<TraceTree.NodeValue>>(
    _props: TraceTreeNodeDetailsProps<NodeType>
  ): React.ReactNode {
    return null;
  }

  matchWithFreeText(_key: string): boolean {
    return false;
  }
}
