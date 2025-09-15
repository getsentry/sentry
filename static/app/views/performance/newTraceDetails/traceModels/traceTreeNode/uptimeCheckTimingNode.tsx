import type {Theme} from '@emotion/react';

import {pickBarColor} from 'sentry/components/performance/waterfall/utils';
import {UptimeTimingDetails} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/uptime/timing';
import type {TraceTreeNodeDetailsProps} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceTreeNodeDetails';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {TraceTreeNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode';
import type {TraceRowProps} from 'sentry/views/performance/newTraceDetails/traceRow/traceRow';
import {TraceSpanRow} from 'sentry/views/performance/newTraceDetails/traceRow/traceSpanRow';

import {BaseNode} from './baseNode';

export class UptimeCheckTimingNode extends BaseNode<TraceTree.UptimeCheckTiming> {
  get drawerTabsTitle(): string {
    return this.value.description || this.value.op;
  }

  get traceHeaderTitle(): {title: string; subtitle?: string} {
    return {title: this.value.description || this.value.op};
  }

  pathToNode(): TraceTree.NodePath[] {
    return [`uptime-check-timing-${this.id}`];
  }

  analyticsName(): string {
    return this.value.event_id;
  }

  printNode(): string {
    return this.value.event_id;
  }

  renderWaterfallRow<NodeType extends TraceTree.Node = TraceTree.Node>(
    props: TraceRowProps<NodeType>
  ): React.ReactNode {
    return (
      <TraceSpanRow
        {...props}
        node={this as unknown as TraceTreeNode<TraceTree.UptimeCheckTiming>}
      />
    );
  }

  renderDetails<NodeType extends TraceTreeNode<TraceTree.NodeValue>>(
    props: TraceTreeNodeDetailsProps<NodeType>
  ): React.ReactNode {
    return (
      <UptimeTimingDetails
        {...props}
        node={this as unknown as TraceTreeNode<TraceTree.UptimeCheckTiming>}
      />
    );
  }

  matchWithFreeText(query: string): boolean {
    if (
      this.value.description &&
      this.value.description.toLowerCase().includes(query.toLowerCase())
    ) {
      return true;
    }

    if (this.value.op && this.value.op.toLowerCase().includes(query.toLowerCase())) {
      return true;
    }

    return false;
  }

  makeBarColor(theme: Theme): string {
    return pickBarColor(this.value.op, theme);
  }
}
