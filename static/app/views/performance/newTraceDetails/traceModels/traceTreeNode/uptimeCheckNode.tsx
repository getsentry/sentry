import type {Theme} from '@emotion/react';

import {pickBarColor} from 'sentry/components/performance/waterfall/utils';
import {t} from 'sentry/locale';
import {uniqueId} from 'sentry/utils/guid';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {UptimeNodeDetails} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/uptime';
import type {TraceTreeNodeDetailsProps} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceTreeNodeDetails';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {TraceRowProps} from 'sentry/views/performance/newTraceDetails/traceRow/traceRow';
import {TraceUptimeCheckNodeRow} from 'sentry/views/performance/newTraceDetails/traceRow/traceUptimeCheckNode';

import {BaseNode, type TraceTreeNodeExtra} from './baseNode';
import {UptimeCheckTimingNode} from './uptimeCheckTimingNode';

export class UptimeCheckNode extends BaseNode<TraceTree.UptimeCheck> {
  id: string;
  type: TraceTree.NodeType;

  searchPriority = 1;
  constructor(
    parent: BaseNode | null,
    value: TraceTree.UptimeCheck,
    extra: TraceTreeNodeExtra
  ) {
    super(parent, value, extra);
    const timingNodes = this._createTimingNodes();
    timingNodes.forEach(timingNode => this.children.push(timingNode));
    this.isEAPEvent = true;
    this.id = this.value.event_id;
    this.type = 'uptime-check';
    this.traceItemDataset = TraceItemDataset.UPTIME_RESULTS;

    this.parent?.children.push(this);
  }

  _createTimingNodes(): UptimeCheckTimingNode[] {
    const uptimeCheck = this.value;
    const attrs = uptimeCheck.additional_attributes || {};

    // Create fake spans for each timing phase
    const phases: Array<{
      description: string;
      durationUs: number;
      op: string;
      startUs: number;
    }> = [
      {
        op: 'dns.lookup.duration',
        description: t('DNS lookup'),
        durationUs: Number(attrs.dns_lookup_duration_us || 0),
        startUs: Number(attrs.dns_lookup_start_us || 0),
      },
      {
        op: 'http.tcp_connection.duration',
        description: t('TCP connect'),
        durationUs: Number(attrs.tcp_connection_duration_us || 0),
        startUs: Number(attrs.tcp_connection_start_us || 0),
      },
      {
        op: 'tls.handshake.duration',
        description: t('TLS handshake'),
        durationUs: Number(attrs.tls_handshake_duration_us || 0),
        startUs: Number(attrs.tls_handshake_start_us || 0),
      },
      {
        op: 'http.client.request.duration',
        description: t('Send request'),
        durationUs: Number(attrs.send_request_duration_us || 0),
        startUs: Number(attrs.send_request_start_us || 0),
      },
      {
        op: 'http.server.time_to_first_byte',
        description: t('Waiting for response'),
        durationUs: Number(attrs.time_to_first_byte_duration_us || 0),
        startUs: Number(attrs.time_to_first_byte_start_us || 0),
      },
      {
        op: 'http.client.response.duration',
        description: t('Receive response'),
        durationUs: Number(attrs.receive_response_duration_us || 0),
        startUs: Number(attrs.receive_response_start_us || 0),
      },
    ];

    const fakeSpans = phases.map(phase => {
      const startTimestamp = phase.startUs / 1_000_000;
      const duration = phase.durationUs / 1_000_000;

      const fakeSpan: TraceTree.UptimeCheckTiming = {
        event_type: 'uptime_check_timing',
        event_id: uniqueId(),
        start_timestamp: startTimestamp,
        end_timestamp: startTimestamp + duration,
        duration,
        op: phase.op,
        description: phase.description,
      };

      const timingNode = new UptimeCheckTimingNode(this, fakeSpan, this.extra);

      // Calculate space bounds for the waterfall (start time in ms, duration in ms)
      const startMs = startTimestamp * 1000;
      const durationMs = duration * 1000;
      timingNode.space = [startMs, durationMs];

      return timingNode;
    });

    // Sort spans chronologically
    fakeSpans.sort((a, b) => a.value.start_timestamp - b.value.start_timestamp);

    return fakeSpans;
  }

  get description(): string | undefined {
    const otelFriendlyUi = this.extra?.organization.features.includes(
      'performance-otel-friendly-ui'
    );
    return otelFriendlyUi ? this.value.name : this.value.description;
  }

  get drawerTabsTitle(): string {
    return this.op + (this.value.description ? ' - ' + this.value.description : '');
  }

  get traceHeaderTitle(): {title: string; subtitle?: string} {
    return {
      title: t('Uptime Monitor Check'),
      subtitle: `${this.value.additional_attributes?.method} ${this.value.additional_attributes?.request_url}`,
    };
  }

  analyticsName(): string {
    return 'uptime check';
  }

  printNode(): string {
    return `uptime check ${this.id}`;
  }

  renderWaterfallRow<NodeType extends TraceTree.Node = TraceTree.Node>(
    props: TraceRowProps<NodeType>
  ): React.ReactNode {
    return <TraceUptimeCheckNodeRow {...props} node={this} />;
  }

  renderDetails<NodeType extends BaseNode>(
    props: TraceTreeNodeDetailsProps<NodeType>
  ): React.ReactNode {
    return <UptimeNodeDetails {...props} node={this} />;
  }

  matchWithFreeText(query: string): boolean {
    return (
      this.op?.includes(query) || this.description?.includes(query) || this.id === query
    );
  }

  makeBarColor(theme: Theme): string {
    return pickBarColor(this.op, theme);
  }

  resolveValueFromSearchKey(_key: string): any | null {
    return null;
  }
}
