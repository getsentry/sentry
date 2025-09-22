import type {Theme} from '@emotion/react';

import {pickBarColor} from 'sentry/components/performance/waterfall/utils';
import {t} from 'sentry/locale';
import type {EventTransaction} from 'sentry/types/event';
import {SpanNodeDetails} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/span';
import type {TraceTreeNodeDetailsProps} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceTreeNodeDetails';
import {isTransactionNode} from 'sentry/views/performance/newTraceDetails/traceGuards';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {TraceTreeNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode';
import type {TraceRowProps} from 'sentry/views/performance/newTraceDetails/traceRow/traceRow';
import {TraceSpanRow} from 'sentry/views/performance/newTraceDetails/traceRow/traceSpanRow';

import {BaseNode, type TraceTreeNodeExtra} from './baseNode';

export class SpanNode extends BaseNode<TraceTree.Span> {
  event: EventTransaction | null = null;
  canAutogroup = true;
  allowNoInstrumentationNodes = true;

  constructor(
    parent: BaseNode | null,
    value: TraceTree.Span,
    extra: TraceTreeNodeExtra | null
  ) {
    super(parent, value, extra);

    if (value) {
      this.space = [
        value.start_timestamp * 1e3,
        (value.timestamp - value.start_timestamp) * 1e3,
      ];
    }

    // Android creates TCP connection spans which are noisy and not useful in most cases.
    // Unless the span has a child txn which would indicate a continuaton of the trace, we collapse it.
    this.expanded = !(
      this.value.op === 'http.client' && this.value.origin === 'auto.http.okhttp'
    );
  }

  get id(): string {
    return this.value.span_id;
  }

  get description(): string | undefined {
    return this.value.description;
  }

  get endTimestamp(): number {
    return this.value.timestamp;
  }

  get startTimestamp(): number {
    return this.value.start_timestamp;
  }

  get drawerTabsTitle(): string {
    return this.op + (this.value.description ? ' - ' + this.value.description : '');
  }

  get traceHeaderTitle(): {title: string; subtitle?: string} {
    return {
      title: this.op || t('Trace'),
      subtitle: this.value.description,
    };
  }

  makeBarColor(theme: Theme): string {
    return pickBarColor(this.op, theme);
  }

  pathToNode(): TraceTree.NodePath[] {
    const path: TraceTree.NodePath[] = [];
    const closestTransaction = this.findParent(p => isTransactionNode(p as any));

    path.push(`span-${this.id}`);

    if (closestTransaction) {
      path.push(`txn-${closestTransaction.id}`);
    }

    return path;
  }

  analyticsName(): string {
    return 'span';
  }

  printNode(): string {
    const prefix =
      this.value.data && !!this.value.data['http.request.prefetch'] ? '(prefetch) ' : '';
    return (
      (this.op || 'unknown span') +
      ' - ' +
      prefix +
      (this.description || 'unknown description')
    );
  }

  renderWaterfallRow<T extends TraceTree.Node = TraceTree.Node>(
    props: TraceRowProps<T>
  ): React.ReactNode {
    // Won't need this cast once we use BaseNode type for props.node
    return (
      <TraceSpanRow
        {...props}
        node={props.node as unknown as TraceTreeNode<TraceTree.Span>}
      />
    );
  }

  renderDetails<T extends TraceTreeNode<TraceTree.NodeValue>>(
    props: TraceTreeNodeDetailsProps<T>
  ): React.ReactNode {
    return (
      <SpanNodeDetails {...props} node={props.node as TraceTreeNode<TraceTree.Span>} />
    );
  }

  matchWithFreeText(query: string): boolean {
    return (
      this.op?.includes(query) || this.description?.includes(query) || this.id === query
    );
  }
}
