import type {TraceTreeNodeDetailsProps} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceTreeNodeDetails';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {TraceRootRow} from 'sentry/views/performance/newTraceDetails/traceRow/traceRootNode';
import type {TraceRowProps} from 'sentry/views/performance/newTraceDetails/traceRow/traceRow';

import {BaseNode, type TraceTreeNodeExtra} from './baseNode';
import type {RootNode} from './rootNode';

export class TraceNode extends BaseNode<TraceTree.EAPTrace> {
  id: string;
  type: TraceTree.NodeType;
  fetchStatus: 'idle' | 'loading' = 'idle';

  // We want to enforce the parent to only be a RootNode or null
  constructor(
    parent: RootNode | null,
    value: TraceTree.EAPTrace,
    extra: TraceTreeNodeExtra
  ) {
    super(parent, value, extra);
    this.canShowDetails = false;
    this.id = 'root';
    this.type = 'trace';
    this.isEAPEvent = true;
    this.parent?.children.push(this);
  }

  get drawerTabsTitle(): string {
    return 'Trace';
  }

  get traceHeaderTitle(): {title: string; subtitle?: string} {
    return {title: 'Trace'};
  }

  analyticsName(): string {
    return 'trace';
  }

  printNode(): string {
    return 'eap trace root';
  }

  matchById(_id: string): boolean {
    return false;
  }

  matchByPath(path: TraceTree.NodePath): boolean {
    return path === 'trace-root';
  }

  renderWaterfallRow<T extends TraceTree.Node = TraceTree.Node>(
    props: TraceRowProps<T>
  ): React.ReactNode {
    return <TraceRootRow {...props} node={this} />;
  }

  renderDetails<T extends BaseNode>(
    _props: TraceTreeNodeDetailsProps<T>
  ): React.ReactNode {
    return null;
  }

  matchWithFreeText(_key: string): boolean {
    return false;
  }

  expand(_expanding: boolean, _tree: TraceTree): boolean {
    return false;
  }

  resolveValueFromSearchKey(_key: string): any | null {
    return null;
  }
}
