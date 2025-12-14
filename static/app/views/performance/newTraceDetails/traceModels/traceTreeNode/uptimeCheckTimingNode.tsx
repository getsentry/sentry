import type {Theme} from '@emotion/react';

import {pickBarColor} from 'sentry/components/performance/waterfall/utils';
import {UptimeTimingDetails} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/uptime/timing';
import type {TraceTreeNodeDetailsProps} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceTreeNodeDetails';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {TraceRowProps} from 'sentry/views/performance/newTraceDetails/traceRow/traceRow';
import {TraceUptimeCheckTimingNodeRow} from 'sentry/views/performance/newTraceDetails/traceRow/traceUptimeCheckTimingNode';

import {BaseNode} from './baseNode';

export class UptimeCheckTimingNode extends BaseNode<TraceTree.UptimeCheckTiming> {
  id: string = this.value.event_id;
  type: TraceTree.NodeType = 'uptime-check-timing';

  get drawerTabsTitle(): string {
    return this.value.description || this.value.op;
  }

  get traceHeaderTitle(): {title: string; subtitle?: string} {
    return {title: this.value.description || this.value.op};
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
      <TraceUptimeCheckTimingNodeRow
        {...props}
        // Won't need this cast once we use BaseNode type for props.node
        node={this}
      />
    );
  }

  renderDetails<NodeType extends BaseNode>(
    props: TraceTreeNodeDetailsProps<NodeType>
  ): React.ReactNode {
    return <UptimeTimingDetails {...props} node={this} />;
  }

  matchWithFreeText(query: string): boolean {
    return (
      this.value.description?.includes(query) ||
      this.op?.includes(query) ||
      this.id === query
    );
  }

  makeBarColor(theme: Theme): string {
    return pickBarColor(this.value.op, theme);
  }

  resolveValueFromSearchKey(_key: string): any | null {
    return null;
  }
}
