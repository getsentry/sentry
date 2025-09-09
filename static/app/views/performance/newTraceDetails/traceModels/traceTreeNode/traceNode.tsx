import {TransactionNodeDetails} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/transaction';
import type {TraceTreeNodeDetailsProps} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceTreeNodeDetails';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {TraceTreeNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode';
import {TraceRootRow} from 'sentry/views/performance/newTraceDetails/traceRow/traceRootNode';
import type {TraceRowProps} from 'sentry/views/performance/newTraceDetails/traceRow/traceRow';

import {BaseNode, type TraceTreeNodeExtra} from './baseNode';
import type {RootNode} from './rootNode';

export class TraceNode extends BaseNode<TraceTree.Trace> {
  // We want to enforce the parent to be a RootNode
  // eslint-disable-next-line @typescript-eslint/no-useless-constructor
  constructor(parent: RootNode, value: TraceTree.Trace, extra: TraceTreeNodeExtra) {
    super(parent, value, extra);
  }

  get drawerTabsTitle(): string {
    return 'Trace';
  }

  get traceHeaderTitle(): {title: string; subtitle?: string} {
    return {title: 'Trace'};
  }

  pathToNode(): TraceTree.NodePath[] {
    return [`trace-root`];
  }

  analyticsName(): string {
    return 'trace';
  }

  printNode(): string {
    return `trace root`;
  }

  renderWaterfallRow<T extends TraceTree.Node = TraceTree.Node>(
    props: TraceRowProps<T>
  ): React.ReactNode {
    return (
      <TraceRootRow {...props} node={props.node as TraceTreeNode<TraceTree.Trace>} />
    );
  }

  renderDetails<T extends TraceTreeNode<TraceTree.NodeValue>>(
    props: TraceTreeNodeDetailsProps<T>
  ): React.ReactNode {
    return (
      <TransactionNodeDetails
        {...props}
        node={props.node as TraceTreeNode<TraceTree.Transaction>}
      />
    );
  }

  matchWithFreeText(_key: string): boolean {
    return false;
  }
}
