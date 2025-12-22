import {uuid4} from '@sentry/core';

import type {TraceTreeNodeDetailsProps} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceTreeNodeDetails';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {TraceCollapsedRow} from 'sentry/views/performance/newTraceDetails/traceRow/traceCollapsedRow';
import type {TraceRowProps} from 'sentry/views/performance/newTraceDetails/traceRow/traceRow';

import {BaseNode, type TraceTreeNodeExtra} from './baseNode';

export class CollapsedNode extends BaseNode<TraceTree.CollapsedNode> {
  id: string;
  type: TraceTree.NodeType;
  readonly expanded: boolean = false;

  constructor(
    parent: BaseNode,
    value: TraceTree.CollapsedNode,
    extra: TraceTreeNodeExtra | null
  ) {
    super(parent, value, extra);
    this.id = uuid4();
    this.type = 'collapsed';
    this.canShowDetails = false;

    this.parent?.children.push(this);
  }

  get drawerTabsTitle(): string {
    return 'Collapsed';
  }

  get traceHeaderTitle(): {title: string; subtitle?: string} {
    return {title: 'Collapsed'};
  }

  printNode(): string {
    return 'collapsed';
  }

  analyticsName(): string {
    return 'collapsed';
  }

  renderWaterfallRow<NodeType extends TraceTree.Node = TraceTree.Node>(
    props: TraceRowProps<NodeType>
  ): React.ReactNode {
    return <TraceCollapsedRow {...props} node={this} />;
  }

  renderDetails<NodeType extends BaseNode>(
    _props: TraceTreeNodeDetailsProps<NodeType>
  ): React.ReactNode {
    return null;
  }

  matchWithFreeText(_key: string): boolean {
    return false;
  }

  resolveValueFromSearchKey(_key: string): any | null {
    return null;
  }
}
