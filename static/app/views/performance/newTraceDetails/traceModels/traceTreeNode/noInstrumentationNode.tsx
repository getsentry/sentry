import type {Theme} from '@emotion/react';
import {uuid4} from '@sentry/core';

import {t} from 'sentry/locale';
import {MissingInstrumentationNodeDetails} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/missingInstrumentation';
import type {TraceTreeNodeDetailsProps} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceTreeNodeDetails';
import {isTransactionNode} from 'sentry/views/performance/newTraceDetails/traceGuards';
import type {MissingInstrumentationNode} from 'sentry/views/performance/newTraceDetails/traceModels/missingInstrumentationNode';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {TraceTreeNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode';
import {TraceMissingInstrumentationRow} from 'sentry/views/performance/newTraceDetails/traceRow/traceMissingInstrumentationRow';
import type {TraceRowProps} from 'sentry/views/performance/newTraceDetails/traceRow/traceRow';

import {BaseNode, type TraceTreeNodeExtra} from './baseNode';

export class NoInstrumentationNode extends BaseNode<TraceTree.MissingInstrumentationSpan> {
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

    if (this.previous.endTimestamp && this.next.startTimestamp) {
      this.space = [
        this.previous.endTimestamp * 1e3,
        (this.next.startTimestamp - this.previous.endTimestamp) * 1e3,
      ];
    }
  }

  get id(): string {
    return this.previous.id || this.next.id || uuid4();
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

  pathToNode(): TraceTree.NodePath[] {
    const path: TraceTree.NodePath[] = [];
    const closestTransaction = this.findParent(p => isTransactionNode(p));

    path.push(`ms-${this.id}`);

    if (closestTransaction) {
      path.push(`txn-${closestTransaction.id}`);
    }

    return path;
  }

  matchByPath(path: TraceTree.NodePath): boolean {
    const [type, id] = path.split('-');
    if (type !== 'ms' || !id) {
      return false;
    }

    return this.matchById(id);
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
    return (
      <TraceMissingInstrumentationRow
        {...props}
        // Won't need this cast once we use BaseNode type for props.node
        node={
          props.node as unknown as TraceTreeNode<TraceTree.MissingInstrumentationSpan>
        }
      />
    );
  }

  renderDetails<NodeType extends TraceTreeNode<TraceTree.NodeValue>>(
    props: TraceTreeNodeDetailsProps<NodeType>
  ): React.ReactNode {
    // Won't need this cast once we use BaseNode type for props.node
    return (
      <MissingInstrumentationNodeDetails
        {...props}
        node={props.node as unknown as MissingInstrumentationNode}
      />
    );
  }

  matchById(id: string): boolean {
    return this.previous.id === id || this.next.id === id;
  }

  matchWithFreeText(_query: string): boolean {
    return false;
  }

  makeBarColor(theme: Theme): string {
    return theme.gray300;
  }
}
