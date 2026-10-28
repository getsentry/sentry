import {lazy} from 'react';
import type {Theme} from '@emotion/react';

import {LazyLoad} from 'sentry/components/lazyLoad';
import {pickBarColor} from 'sentry/components/performance/waterfall/utils';
import type {TraceTreeNodeDetailsProps} from 'sentry/views/performance/traceDetails/traceDrawer/tabs/traceTreeNodeDetails';
import type {TraceTree} from 'sentry/views/performance/traceDetails/traceModels/traceTree';
import type {TraceRowProps} from 'sentry/views/performance/traceDetails/traceRow/traceRow';
import {TraceUptimeCheckTimingNodeRow} from 'sentry/views/performance/traceDetails/traceRow/traceUptimeCheckTimingNode';

import {BaseNode} from './baseNode';

// Lazy so that building a trace tree does not pull in the drawer's details UI.
const LazyUptimeTimingDetails = lazy(() =>
  import('sentry/views/performance/traceDetails/traceDrawer/details/uptime/timing').then(
    module => ({
      default: module.UptimeTimingDetails,
    })
  )
);

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
    return <LazyLoad LazyComponent={LazyUptimeTimingDetails} {...props} node={this} />;
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
