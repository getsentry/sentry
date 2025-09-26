import type {TraceTreeNodeDetailsProps} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceTreeNodeDetails';
import type {CollapsedNode as LegacyCollapsedNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceCollapsedNode';
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

  get drawerTabsTitle(): string {
    return 'Collapsed';
  }

  get traceHeaderTitle(): {title: string; subtitle?: string} {
    return {title: 'Collapsed'};
  }

  printNode(): string {
    return 'collapsed';
  }

  matchByPath(_path: TraceTree.NodePath): boolean {
    return false;
  }

  pathToNode(): TraceTree.NodePath[] {
    return [];
  }

  analyticsName(): string {
    return 'collapsed';
  }

  renderWaterfallRow<NodeType extends TraceTree.Node = TraceTree.Node>(
    props: TraceRowProps<NodeType>
  ): React.ReactNode {
    // Won't need this cast once we use BaseNode type for props.node
    return (
      <TraceCollapsedRow {...props} node={props.node as unknown as LegacyCollapsedNode} />
    );
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
