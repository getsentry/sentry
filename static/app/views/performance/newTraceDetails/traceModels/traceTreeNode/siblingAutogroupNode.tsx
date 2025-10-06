import type {Theme} from '@emotion/react';

import {t} from 'sentry/locale';
import {AutogroupNodeDetails} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/autogroup';
import type {TraceTreeNodeDetailsProps} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceTreeNodeDetails';
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

  get type(): TraceTree.NodeType {
    return 'ag';
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
    // @ts-expect-error Abdullah Khan: Will be fixed as BaseNode is used in TraceTree
    return <TraceAutogroupedRow {...props} node={props.node} />;
  }

  renderDetails<NodeType extends TraceTreeNode<TraceTree.NodeValue>>(
    props: TraceTreeNodeDetailsProps<NodeType>
  ): React.ReactNode {
    // @ts-expect-error Abdullah Khan: Will be fixed as BaseNode is used in TraceTree
    return <AutogroupNodeDetails {...props} node={props.node} />;
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

    return this.id === id;
  }

  matchWithFreeText(query: string): boolean {
    return this.op?.includes(query) || this.description?.includes(query);
  }

  makeBarColor(theme: Theme): string {
    if (this.errors.size > 0) {
      return theme.red300;
    }

    return theme.blue300;
  }
}
