import {TransactionNodeDetails} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/transaction';
import type {TraceTreeNodeDetailsProps} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceTreeNodeDetails';
import {isTraceSplitResult} from 'sentry/views/performance/newTraceDetails/traceGuards';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {TraceTreeNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode';
import {TraceRootRow} from 'sentry/views/performance/newTraceDetails/traceRow/traceRootNode';
import type {TraceRowProps} from 'sentry/views/performance/newTraceDetails/traceRow/traceRow';

import {BaseNode, type TraceTreeNodeExtra} from './baseNode';
import type {RootNode} from './rootNode';
import {traceChronologicalSort} from './utils';

export class TraceNode extends BaseNode<TraceTree.Trace> {
  // We want to enforce the parent to only be a RootNode or null
  // eslint-disable-next-line @typescript-eslint/no-useless-constructor
  constructor(
    parent: RootNode | null,
    value: TraceTree.Trace,
    extra: TraceTreeNodeExtra
  ) {
    super(parent, value, extra);

    this.parent?.children.push(this);
    this.parent?.children.sort(traceChronologicalSort);
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
    return isTraceSplitResult(this.value) ? 'trace root' : 'eap trace root';
  }

  matchById(_id: string): boolean {
    return false;
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

  expand(_expanding: boolean, _tree: TraceTree): boolean {
    return false;
  }
}
