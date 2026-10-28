import {lazy} from 'react';
import type {Theme} from '@emotion/react';

import {LazyLoad} from 'sentry/components/lazyLoad';
import {t} from 'sentry/locale';
import {stripAnsi} from 'sentry/utils/ansiEscapeCodes';
import type {TraceTreeNodeDetailsProps} from 'sentry/views/performance/traceDetails/traceDrawer/tabs/traceTreeNodeDetails';
import {isTraceError} from 'sentry/views/performance/traceDetails/traceGuards';
import type {TraceTree} from 'sentry/views/performance/traceDetails/traceModels/traceTree';
import {TraceErrorRow} from 'sentry/views/performance/traceDetails/traceRow/traceErrorRow';
import type {TraceRowProps} from 'sentry/views/performance/traceDetails/traceRow/traceRow';

import {BaseNode, type TraceTreeNodeExtra} from './baseNode';

// Lazy so that building a trace tree does not pull in the drawer's details UI.
const LazyErrorNodeDetails = lazy(() =>
  import('sentry/views/performance/traceDetails/traceDrawer/details/error').then(
    module => ({
      default: module.ErrorNodeDetails,
    })
  )
);

export class ErrorNode extends BaseNode<TraceTree.TraceErrorIssue> {
  id: string;
  type: TraceTree.NodeType;

  searchPriority = 3;
  constructor(
    parent: BaseNode | null,
    value: TraceTree.TraceErrorIssue,
    extra: TraceTreeNodeExtra
  ) {
    super(parent, value, extra);

    this.id = value.event_id;
    this.type = 'error';
    // Part of the eap trace endpoint but still fetched from nodestore
    this.isEAPEvent = false;

    if (value) {
      if (isTraceError(value) && value.timestamp) {
        this.space = [value.timestamp * 1e3, 0];
      }

      // For error nodes, its value is the only associated issue.
      this.errors.add(value);
    }

    this.parent?.children.push(this);
  }

  get startTimestamp(): number {
    return this.space[0];
  }

  get description(): string | undefined {
    return isTraceError(this.value)
      ? this.value.title || this.value.message
      : this.value.description;
  }

  get traceHeaderTitle(): {
    title: string;
    subtitle?: string;
  } {
    return {
      title: t('Trace'),
      subtitle: this.description,
    };
  }

  get drawerTabsTitle(): string {
    return (this.description && stripAnsi(this.description)) || t('Error');
  }

  analyticsName(): string {
    return isTraceError(this.value) ? 'error' : 'eap error';
  }

  printNode(): string {
    return this.id || this.value.level || 'unknown trace error';
  }

  renderWaterfallRow<NodeType extends TraceTree.Node = TraceTree.Node>(
    props: TraceRowProps<NodeType>
  ): React.ReactNode {
    return <TraceErrorRow {...props} node={this} />;
  }

  renderDetails<T extends BaseNode>(
    props: TraceTreeNodeDetailsProps<T>
  ): React.ReactNode {
    return <LazyLoad LazyComponent={LazyErrorNodeDetails} {...props} node={this} />;
  }

  matchWithFreeText(query: string): boolean {
    const matchesLevel = this.value.level === query;
    const matchesDescription = this.description
      ? this.description.includes(query)
      : false;
    return matchesLevel || matchesDescription;
  }

  makeBarColor(theme: Theme): string {
    switch (this.value.level) {
      case 'sample':
      case 'info':
        return theme.tokens.dataviz.semantic.accent;
      case 'warning':
        return theme.tokens.dataviz.semantic.meh;
      case 'error':
        return theme.level.orange;
      case 'fatal':
        return theme.tokens.dataviz.semantic.bad;
      case 'unknown':
        return theme.tokens.dataviz.semantic.other;
      default:
        return theme.colors.red400;
    }
  }

  resolveValueFromSearchKey(_key: string): any | null {
    return null;
  }
}
