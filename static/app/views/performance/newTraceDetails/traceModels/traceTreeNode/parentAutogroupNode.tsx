import type {Theme} from '@emotion/react';

import {t} from 'sentry/locale';
import {AutogroupNodeDetails} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/autogroup';
import type {TraceTreeNodeDetailsProps} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceTreeNodeDetails';
import type {ParentAutogroupNode as LegacyParentAutogroupNode} from 'sentry/views/performance/newTraceDetails/traceModels/parentAutogroupNode';
import {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {TraceTreeNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode';
import {TraceAutogroupedRow} from 'sentry/views/performance/newTraceDetails/traceRow/traceAutogroupedRow';
import type {TraceRowProps} from 'sentry/views/performance/newTraceDetails/traceRow/traceRow';

import {BaseNode, type TraceTreeNodeExtra} from './baseNode';
import {computeCollapsedBarSpace} from './utils';

export class ParentAutogroupNode extends BaseNode<TraceTree.ChildrenAutogroup> {
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
    this.expanded = false;
  }

  get type(): TraceTree.NodeType {
    return 'ag';
  }

  get id(): string | undefined {
    return this.head.id ?? this.tail.id;
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
    // @ts-expect-error Abdullah Khan: Will be fixed as BaseNode is used in TraceTree
    return <TraceAutogroupedRow {...props} node={props.node} />;
  }

  renderDetails<NodeType extends TraceTreeNode<TraceTree.NodeValue>>(
    props: TraceTreeNodeDetailsProps<NodeType>
  ): React.ReactNode {
    return (
      <AutogroupNodeDetails
        {...props}
        node={props.node as unknown as LegacyParentAutogroupNode}
      />
    );
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

  get directChildren(): BaseNode[] {
    if (this.expanded) {
      return [this.head];
    }

    return this.tail.children;
  }

  get visibleChildren(): BaseNode[] {
    const queue: BaseNode[] = [];
    const visibleChildren: BaseNode[] = [];

    for (let i = this.directChildren.length - 1; i >= 0; i--) {
      queue.push(this.directChildren[i]!);
    }

    while (queue.length > 0) {
      const node = queue.pop()!;

      visibleChildren.push(node);

      const children = node.directChildren;

      for (let i = children.length - 1; i >= 0; i--) {
        queue.push(children[i]!);
      }
    }

    return visibleChildren;
  }

  getNextTraversalNodes(): BaseNode[] {
    return [this.head];
  }

  matchById(_id: string): boolean {
    return false;
  }

  matchByPath(path: TraceTree.NodePath): boolean {
    if (!path.startsWith(`${this.type}-`)) {
      return false;
    }

    // Extract id after the first occurrence of `${this.type}-`
    const id = path.slice(this.type.length + 1);
    if (!id) {
      return false;
    }

    return this.head.id === id || this.tail.id === id;
  }

  expand(expanding: boolean, tree: TraceTree): boolean {
    // @ts-expect-error Abdullah Khan: Will be fixed as BaseNode is used in TraceTree
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
        // @ts-expect-error Abdullah Khan: Will be fixed as BaseNode is used in TraceTree
        tree.list.splice(index + 1, 0, this.head, ...this.head.visibleChildren);
      }
    } else {
      tree.list.splice(index + 1, this.visibleChildren.length);

      // When we collapse the autogroup, we need to point the tail children
      // back to the tail autogroup node.
      for (const c of this.tail.children) {
        c.parent = this;
      }

      // @ts-expect-error Abdullah Khan: Will be fixed as BaseNode is used in TraceTree
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
      return theme.red300;
    }

    return theme.blue300;
  }
}
