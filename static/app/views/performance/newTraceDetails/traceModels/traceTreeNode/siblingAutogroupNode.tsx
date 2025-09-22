import type {Theme} from '@emotion/react';

import {t} from 'sentry/locale';
import {AutogroupNodeDetails} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/autogroup';
import type {TraceTreeNodeDetailsProps} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceTreeNodeDetails';
import {isTransactionNode} from 'sentry/views/performance/newTraceDetails/traceGuards';
import type {SiblingAutogroupNode as LegacySiblingAutogroupNode} from 'sentry/views/performance/newTraceDetails/traceModels/siblingAutogroupNode';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {TraceTreeNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode';
import {TraceAutogroupedRow} from 'sentry/views/performance/newTraceDetails/traceRow/traceAutogroupedRow';
import type {TraceRowProps} from 'sentry/views/performance/newTraceDetails/traceRow/traceRow';

import {BaseNode, type TraceTreeNodeExtra} from './baseNode';
import {computeCollapsedBarSpace} from './utils';

export class SiblingAutogroupNode extends BaseNode<TraceTree.SiblingAutogroup> {
  groupCount = 0;

  private _autogroupedSegments: Array<[number, number]> | undefined;

  constructor(
    parent: BaseNode<TraceTree.NodeValue> | null,
    node: TraceTree.SiblingAutogroup,
    extra: TraceTreeNodeExtra
  ) {
    super(parent, node, extra);
    this.expanded = false;
  }

  get id(): string | undefined {
    const firstChild = this.children[0];
    return firstChild?.id;
  }

  get op(): string {
    return this.value.autogrouped_by.op;
  }

  get description(): string {
    return this.value.autogrouped_by.description;
  }

  get drawerTabsTitle(): string {
    return t('Autogroup') + ' - ' + this.op;
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

  get autogroupedSegments(): Array<[number, number]> {
    if (this._autogroupedSegments) {
      return this._autogroupedSegments;
    }

    this._autogroupedSegments = computeCollapsedBarSpace(this.children);
    return this._autogroupedSegments;
  }

  analyticsName(): string {
    return 'sibling autogroup';
  }

  printNode(): string {
    return `sibling autogroup (${this.op}: ${this.groupCount})`;
  }

  renderWaterfallRow<NodeType extends TraceTree.Node = TraceTree.Node>(
    props: TraceRowProps<NodeType>
  ): React.ReactNode {
    return (
      // Won't need this cast once we use BaseNode type for props.node
      <TraceAutogroupedRow
        {...props}
        node={props.node as unknown as LegacySiblingAutogroupNode}
      />
    );
  }

  pathToNode(): TraceTree.NodePath[] {
    const path: TraceTree.NodePath[] = [];
    const closestTransaction = this.findParent(p => isTransactionNode(p as any));

    path.push(`ag-${this.id}`);

    if (closestTransaction) {
      path.push(`txn-${closestTransaction.id}`);
    }

    return path;
  }

  renderDetails<NodeType extends TraceTreeNode<TraceTree.NodeValue>>(
    props: TraceTreeNodeDetailsProps<NodeType>
  ): React.ReactNode {
    return (
      <AutogroupNodeDetails
        {...props}
        node={props.node as unknown as LegacySiblingAutogroupNode}
      />
    );
  }

  matchById(id: string): boolean {
    return this.children[0]?.id === id;
  }

  matchWithFreeText(query: string): boolean {
    if (this.op?.includes(query)) {
      return true;
    }

    if (this.description?.includes(query)) {
      return true;
    }

    if (
      'name' in this.value &&
      typeof this.value.name === 'string' &&
      this.value.name.includes(query)
    ) {
      return true;
    }

    return false;
  }

  makeBarColor(theme: Theme): string {
    if (this.errors.size > 0) {
      return theme.red300;
    }

    return theme.blue300;
  }
}
