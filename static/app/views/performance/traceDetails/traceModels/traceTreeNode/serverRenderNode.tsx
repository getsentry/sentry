import {t} from 'sentry/locale';
import type {TraceTree} from 'sentry/views/performance/traceDetails/traceModels/traceTree';
import type {TraceRowProps} from 'sentry/views/performance/traceDetails/traceRow/traceRow';
import {TraceServerRenderRow} from 'sentry/views/performance/traceDetails/traceRow/traceServerRenderRow';

import {BaseNode, type TraceTreeNodeExtra} from './baseNode';
import type {EapSpanNode} from './eapSpanNode';

/**
 * Placeholder for the server spans of a reused page, which are in another trace.
 * Its time range (the document request) only places it in the tree.
 */
export class ServerRenderNode extends BaseNode<TraceTree.ServerRenderPlaceholder> {
  id: string;
  type: TraceTree.NodeType;

  readonly pageload: EapSpanNode;

  constructor(
    pageload: EapSpanNode,
    parent: BaseNode,
    value: TraceTree.ServerRenderPlaceholder,
    extra: TraceTreeNodeExtra | null
  ) {
    super(parent, value, extra);

    this.pageload = pageload;
    // Must differ from the pageload ID, so that a lookup by span ID finds the
    // pageload and not this placeholder.
    this.id = `${pageload.id}-server-render`;
    // No hyphen: node paths are `${type}-${id}`, and readers split at the first hyphen.
    this.type = 'sr';
  }

  get description(): string {
    return this.value.part === 'whole_page' ? t('Static page') : t('Static part');
  }

  get drawerTabsTitle(): string {
    return this.description;
  }

  get traceHeaderTitle(): {
    title: string;
    subtitle?: string;
  } {
    return {
      title: t('Trace'),
    };
  }

  analyticsName(): string {
    return 'server render placeholder';
  }

  printNode(): string {
    return `server render placeholder - ${this.value.part}`;
  }

  renderWaterfallRow<NodeType extends TraceTree.Node = TraceTree.Node>(
    props: TraceRowProps<NodeType>
  ): React.ReactNode {
    return <TraceServerRenderRow {...props} node={this} />;
  }

  matchWithFreeText(_query: string): boolean {
    return false;
  }

  resolveValueFromSearchKey(_key: string): any | null {
    return null;
  }
}
