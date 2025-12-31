import type {Theme} from '@emotion/react';
import {uuid4} from '@sentry/core';

import {t} from 'sentry/locale';
import {MissingInstrumentationNodeDetails} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/missingInstrumentation';
import type {TraceTreeNodeDetailsProps} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceTreeNodeDetails';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {TraceMissingInstrumentationRow} from 'sentry/views/performance/newTraceDetails/traceRow/traceMissingInstrumentationRow';
import type {TraceRowProps} from 'sentry/views/performance/newTraceDetails/traceRow/traceRow';

import {BaseNode, type TraceTreeNodeExtra} from './baseNode';

export class NoInstrumentationNode extends BaseNode<TraceTree.MissingInstrumentationSpan> {
  id: string;
  type: TraceTree.NodeType;

  previous: BaseNode;
  next: BaseNode;

  constructor(
    previous: BaseNode,
    next: BaseNode,
    parent: BaseNode | null,
    value: TraceTree.MissingInstrumentationSpan,
    extra: TraceTreeNodeExtra | null
  ) {
    super(parent, value, extra);

    this.previous = previous;
    this.next = next;

    this.id = this.previous.id || this.next.id || uuid4();
    this.type = 'ms';

    if (this.previous.endTimestamp && this.next.startTimestamp) {
      this.space = [
        this.previous.endTimestamp * 1e3,
        (this.next.startTimestamp - this.previous.endTimestamp) * 1e3,
      ];
    }
  }

  get drawerTabsTitle(): string {
    return t('No Instrumentation');
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
    return 'missing instrumentation';
  }

  printNode(): string {
    return 'missing_instrumentation';
  }

  renderWaterfallRow<NodeType extends TraceTree.Node = TraceTree.Node>(
    props: TraceRowProps<NodeType>
  ): React.ReactNode {
    return <TraceMissingInstrumentationRow {...props} node={this} />;
  }

  renderDetails<NodeType extends BaseNode>(
    props: TraceTreeNodeDetailsProps<NodeType>
  ): React.ReactNode {
    // Won't need this cast once we use BaseNode type for props.node
    return <MissingInstrumentationNodeDetails {...props} node={this} />;
  }

  matchById(id: string): boolean {
    return this.previous.id === id || this.next.id === id;
  }

  matchWithFreeText(_query: string): boolean {
    return false;
  }

  makeBarColor(theme: Theme): string {
    return theme.colors.gray400;
  }

  makeBarTextColor(_inside: boolean, theme: Theme): string {
    return theme.subText;
  }

  resolveValueFromSearchKey(_key: string): any | null {
    return null;
  }
}
