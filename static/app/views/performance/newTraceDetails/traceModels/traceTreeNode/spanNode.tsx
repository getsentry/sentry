import type {Theme} from '@emotion/react';

import {pickBarColor} from 'sentry/components/performance/waterfall/utils';
import {t} from 'sentry/locale';
import type {EventTransaction} from 'sentry/types/event';
import {SpanNodeDetails} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/span';
import type {TraceTreeNodeDetailsProps} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceTreeNodeDetails';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {TraceRowProps} from 'sentry/views/performance/newTraceDetails/traceRow/traceRow';
import {TraceSpanRow} from 'sentry/views/performance/newTraceDetails/traceRow/traceSpanRow';

import {BaseNode, type TraceTreeNodeExtra} from './baseNode';

export class SpanNode extends BaseNode<TraceTree.Span> {
  id: string;
  type: TraceTree.NodeType;

  event: EventTransaction | null = null;
  canAutogroup = true;
  allowNoInstrumentationNodes = true;
  searchPriority = 2;

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

    this.id = this.value.span_id;
    this.type = 'span';

    // Android creates TCP connection spans which are noisy and not useful in most cases.
    // Unless the span has a child txn which would indicate a continuaton of the trace, we collapse it.
    this.expanded = !(
      this.value.op === 'http.client' && this.value.origin === 'auto.http.okhttp'
    );
  }

  get endTimestamp(): number {
    return this.value.timestamp;
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

  get sdkName(): string | undefined {
    return this.event?.sdk?.name ?? undefined;
  }

  get profileId(): string | undefined {
    const profileId = super.profileId;
    if (profileId) {
      return profileId;
    }

    return this.findClosestParentTransaction()?.profileId;
  }

  get profilerId(): string | undefined {
    const profilerId = super.profilerId;
    if (profilerId) {
      return profilerId;
    }

    return this.findClosestParentTransaction()?.profilerId;
  }

  get transactionId(): string | undefined {
    const transactionId = super.transactionId;
    if (transactionId) {
      return transactionId;
    }

    return this.findClosestParentTransaction()?.transactionId;
  }

  get attributes(): Record<string, string | number | boolean> | undefined {
    return this.value.data;
  }

  get projectSlug(): string {
    // The span value does not have a project slug, so we need to find a parent that has one.
    // If we don't find one, we return the default project slug.
    return this.findParent(p => !!p.projectSlug)?.projectSlug ?? 'default';
  }

  makeBarColor(theme: Theme): string {
    return pickBarColor(this.op, theme);
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
    return <TraceSpanRow {...props} node={this} />;
  }

  renderDetails<T extends BaseNode>(
    props: TraceTreeNodeDetailsProps<T>
  ): React.ReactNode {
    return <SpanNodeDetails {...props} node={this} />;
  }

  matchWithFreeText(query: string): boolean {
    return (
      this.op?.includes(query) || this.description?.includes(query) || this.id === query
    );
  }

  resolveValueFromSearchKey(key: string): any | null {
    if (key === 'span.self_time' || key === 'span.exclusive_time') {
      return this.value.exclusive_time;
    }

    if (['duration', 'span.duration', 'span.total_time'].includes(key)) {
      return this.space[1];
    }

    // @TODO perf optimization opportunity
    // Entity check should be preprocessed per token, not once per token per node we are evaluating, however since
    // we are searching <10k nodes in p99 percent of the time and the search is non blocking, we are likely fine
    // and can be optimized later.
    const [maybeEntity, ...rest] = key.split('.');
    if (maybeEntity === 'span') {
      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      return this.value[rest.join('.')];
    }

    return null;
  }
}
