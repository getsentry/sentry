import {t} from 'sentry/locale';
import type {TraceTreeNodeDetailsProps} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceTreeNodeDetails';
import {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {TraceTreeNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode';
import type {TraceRowProps} from 'sentry/views/performance/newTraceDetails/traceRow/traceRow';

import {BaseNode, type TraceTreeNodeExtra} from './baseNode';
import {TraceNode} from './traceNode';

export class RootNode extends BaseNode<null> {
  children: [TraceNode];

  constructor(parent: null, value: TraceTree.Trace, extra: TraceTreeNodeExtra) {
    super(parent, null, extra);
    this.children = [new TraceNode(this, value, extra)];
  }

  get drawerTabsTitle(): string {
    return t('Root');
  }

  get traceHeaderTitle(): {title: string; subtitle?: string} {
    return {title: t('Trace')};
  }

  printNode(): string {
    return 'virtual root';
  }

  analyticsName(): string {
    return 'root';
  }

  pathToNode(): TraceTree.NodePath[] {
    return [`virtual-root`];
  }

  renderWaterfallRow<T extends TraceTree.Node = TraceTree.Node>(
    _props: TraceRowProps<T>
  ): React.ReactNode {
    return null;
  }

  renderDetails<T extends TraceTreeNode<TraceTree.NodeValue>>(
    _props: TraceTreeNodeDetailsProps<T>
  ): React.ReactNode {
    return null;
  }

  matchWithFreeText(_key: string): boolean {
    return false;
  }
}
