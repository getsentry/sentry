import type {Theme} from '@emotion/react';

import {t} from 'sentry/locale';
import {AutogroupNodeDetails} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/autogroup';
import type {TraceTreeNodeDetailsProps} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceTreeNodeDetails';
import {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {TraceAutogroupedRow} from 'sentry/views/performance/newTraceDetails/traceRow/traceAutogroupedRow';
import type {TraceRowProps} from 'sentry/views/performance/newTraceDetails/traceRow/traceRow';

import {BaseNode, type TraceTreeNodeExtra} from './baseNode';
import {computeCollapsedBarSpace} from './utils';

export class ParentAutogroupNode extends BaseNode<TraceTree.ChildrenAutogroup> {
  id: string;
  type: TraceTree.NodeType;

  head: BaseNode;
  tail: BaseNode;
  groupCount = 0;

  private _autogroupedSegments: Array<[number, number]> | undefined;

  constructor(
    parent: BaseNode | null,
    node: TraceTree.ChildrenAutogroup,
    extra: TraceTreeNodeExtra | null,
    head: BaseNode,
    tail: BaseNode
  ) {
    super(parent, node, extra);
    this.head = head;
    this.tail = tail;
    this.id = this.head.id || this.tail.id;
    this.type = 'ag';
    this.expanded = false;
  }

  get autogroupedSegments(): Array<[number, number]> {
    if (this._autogroupedSegments) {
      return this._autogroupedSegments;
    }

    const children: BaseNode[] = [];
    let start: BaseNode | undefined = this.head;

    while (start && start !== this.tail) {
      children.push(start);
      start = start.children[0];
    }

    children.push(this.tail);

    this._autogroupedSegments = computeCollapsedBarSpace(children);
    return this._autogroupedSegments;
  }

  get drawerTabsTitle(): string {
    return t('Autogroup') + (this.op ? ' - ' + this.op : '');
  }

  get op(): string {
    return this.value.autogrouped_by.op;
  }

  printNode(): string {
    return `parent autogroup (${this.op}: ${this.groupCount})`;
  }

  analyticsName(): string {
    return 'parent autogroup';
  }

  renderWaterfallRow<NodeType extends TraceTree.Node = TraceTree.Node>(
    props: TraceRowProps<NodeType>
  ): React.ReactNode {
    return <TraceAutogroupedRow {...props} node={this} />;
  }

  renderDetails<NodeType extends BaseNode>(
    props: TraceTreeNodeDetailsProps<NodeType>
  ): React.ReactNode {
    return <AutogroupNodeDetails {...props} node={this} />;
  }

  matchWithFreeText(query: string): boolean {
    return this.op?.includes(query);
  }

  get traceHeaderTitle(): {
    title: string;
    subtitle?: string;
  } {
    return {
      title: this.op || t('Trace'),
      subtitle: this.description,
    };
  }

  get directVisibleChildren(): BaseNode[] {
    if (this.expanded) {
      return [this.head];
    }

    return this.tail.children;
  }

  getNextTraversalNodes(): BaseNode[] {
    return [this.head];
  }

  matchById(_id: string): boolean {
    return false;
  }

  expand(expanding: boolean, tree: TraceTree): boolean {
    const index = tree.list.indexOf(this);

    // Expanding is not allowed for zoomed in nodes
    if (expanding === this.expanded || this.hasFetchedChildren) {
      return false;
    }

    if (expanding) {
      // Adding the index check here because the node may not be in the list,
      // since we explicitly hide all non-transaction nodes on load in the eap-watefall.
      // The node is part of the tree, but not visible yet. Check can be pushed to the top of the function
      // when we no longer have to support non-eap traces.
      if (index !== -1) {
        tree.list.splice(index + 1, this.visibleChildren.length);
      }

      // When the node is collapsed, children point to the autogrouped node.
      // We need to point them back to the tail node which is now visible
      for (const c of this.tail.children) {
        c.parent = this.tail;
      }

      // Adding the index check here because the node may not be in the list,
      // since we explicitly hide all non-transaction nodes on load in the eap-watefall.
      // The node is part of the tree, but not visible yet.Check can be pushed to the top of the function
      // when we no longer have to support non-eap traces.
      if (index !== -1) {
        tree.list.splice(index + 1, 0, this.head, ...this.head.visibleChildren);
      }
    } else {
      tree.list.splice(index + 1, this.visibleChildren.length);

      // When we collapse the autogroup, we need to point the tail children
      // back to the tail autogroup node.
      for (const c of this.tail.children) {
        c.parent = this;
      }

      tree.list.splice(index + 1, 0, ...this.tail.visibleChildren);
    }

    this.invalidate();
    this.forEachChild(child => {
      child.invalidate();
    });
    this.expanded = expanding;
    return true;
  }

  makeBarColor(theme: Theme): string {
    if (this.errors.size > 0) {
      return theme.colors.red400;
    }

    return theme.colors.blue400;
  }

  resolveValueFromSearchKey(_key: string): any | null {
    return null;
  }
}
