import {uuid4} from '@sentry/core';

import {t} from 'sentry/locale';
import type {TraceTreeNodeDetailsProps} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceTreeNodeDetails';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {TraceRowProps} from 'sentry/views/performance/newTraceDetails/traceRow/traceRow';

import {BaseNode} from './baseNode';

export class RootNode extends BaseNode<null> {
  id: string = uuid4();
  type: TraceTree.NodeType = 'root';

  canShowDetails = false;

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

  renderDetails<T extends BaseNode>(
    _props: TraceTreeNodeDetailsProps<T>
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
