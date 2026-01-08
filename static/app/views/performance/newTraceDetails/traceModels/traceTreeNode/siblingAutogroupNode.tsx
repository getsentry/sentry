import type {Theme} from '@emotion/react';
import {uuid4} from '@sentry/core';

import {t} from 'sentry/locale';
import {AutogroupNodeDetails} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/autogroup';
import type {TraceTreeNodeDetailsProps} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceTreeNodeDetails';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {TraceAutogroupedRow} from 'sentry/views/performance/newTraceDetails/traceRow/traceAutogroupedRow';
import type {TraceRowProps} from 'sentry/views/performance/newTraceDetails/traceRow/traceRow';

import {BaseNode, type TraceTreeNodeExtra} from './baseNode';
import {computeCollapsedBarSpace} from './utils';

export class SiblingAutogroupNode extends BaseNode<TraceTree.SiblingAutogroup> {
  id: string;
  type: TraceTree.NodeType;

  groupCount = 0;

  private _autogroupedSegments: Array<[number, number]> | undefined;

  constructor(
    parent: BaseNode<TraceTree.NodeValue> | null,
    node: TraceTree.SiblingAutogroup,
    extra: TraceTreeNodeExtra
  ) {
    super(parent, node, extra);

    this.id = this.parent?.id ?? uuid4();
    this.type = 'ag';

    this.expanded = false;
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
    return <TraceAutogroupedRow {...props} node={this} />;
  }

  renderDetails<NodeType extends BaseNode>(
    props: TraceTreeNodeDetailsProps<NodeType>
  ): React.ReactNode {
    return <AutogroupNodeDetails {...props} node={this} />;
  }

  matchById(_id: string): boolean {
    return false;
  }

  matchWithFreeText(query: string): boolean {
    return this.op?.includes(query) || this.description?.includes(query);
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
