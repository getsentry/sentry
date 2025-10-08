import {uuid4} from '@sentry/core';

import {t} from 'sentry/locale';
import type {TraceTreeNodeDetailsProps} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceTreeNodeDetails';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {TraceTreeNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode';
import type {TraceRowProps} from 'sentry/views/performance/newTraceDetails/traceRow/traceRow';

import {BaseNode} from './baseNode';

export class RootNode extends BaseNode<null> {
  canShowDetails = false;

  get id(): string {
    return uuid4();
  }

  get type(): TraceTree.NodeType {
    return 'root';
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
