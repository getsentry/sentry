import type {Theme} from '@emotion/react';

import {t} from 'sentry/locale';
import {ErrorNodeDetails} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/error';
import type {TraceTreeNodeDetailsProps} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceTreeNodeDetails';
import {
  isEAPError,
  isTraceError,
} from 'sentry/views/performance/newTraceDetails/traceGuards';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {TraceTreeNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode';
import {TraceErrorRow} from 'sentry/views/performance/newTraceDetails/traceRow/traceErrorRow';
import type {TraceRowProps} from 'sentry/views/performance/newTraceDetails/traceRow/traceRow';

import {BaseNode, type TraceTreeNodeExtra} from './baseNode';

export class ErrorNode extends BaseNode<TraceTree.TraceErrorIssue> {
  searchPriority = 3;
  constructor(
    parent: BaseNode | null,
    value: TraceTree.TraceErrorIssue,
    extra: TraceTreeNodeExtra
  ) {
    super(parent, value, extra);

    this.isEAPEvent = isEAPError(value);

    if (value) {
      if (isTraceError(value) && value.timestamp) {
        this.space = [value.timestamp * 1e3, 0];
      }

      // For error nodes, its value is the only associated issue.
      this.errors.add(value);
    }

    this.parent?.children.push(this);
  }

  get type(): TraceTree.NodeType {
    return 'error';
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
    return this.description || t('Error');
  }

  analyticsName(): string {
    return isTraceError(this.value) ? 'error' : 'eap error';
  }

  printNode(): string {
    return this.id || this.value.level || 'unknown trace error';
  }

  matchByPath(path: TraceTree.NodePath): boolean {
    const [type, id] = path.split('-');
    if (type !== 'error' || !id) {
      return false;
    }

    return this.matchById(id);
  }

  renderWaterfallRow<NodeType extends TraceTree.Node = TraceTree.Node>(
    props: TraceRowProps<NodeType>
  ): React.ReactNode {
    return <TraceErrorRow {...props} node={props.node} />;
  }

  renderDetails<T extends TraceTreeNode<TraceTree.NodeValue>>(
    props: TraceTreeNodeDetailsProps<T>
  ): React.ReactNode {
    return (
      <ErrorNodeDetails
        {...props}
        node={
          props.node as
            | TraceTreeNode<TraceTree.TraceError>
            | TraceTreeNode<TraceTree.EAPError>
        }
      />
    );
  }

  matchWithFreeText(query: string): boolean {
    const matchesLevel = this.value.level === query;
    const matchesDescription = this.description
      ? this.description.includes(query)
      : false;
    return matchesLevel || matchesDescription;
  }

  makeBarColor(theme: Theme): string {
    // Theme defines this as orange, yet everywhere in our product we show red for errors
    if (this.value.level === 'error' || this.value.level === 'fatal') {
      return theme.red300;
    }
    if (this.value.level) {
      return theme.level[this.value.level] ?? theme.red300;
    }
    return theme.red300;
  }
}
