import type {RawSpanType} from 'sentry/components/events/interfaces/spans/types';
import {t} from 'sentry/locale';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {TraceTreeNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode';

import {type SectionCardKeyValueList, TraceDrawerComponents} from '../../styles';
import {TraceDrawerActionValueKind} from '../../utils';

export function hasSpanTags(span: RawSpanType) {
  return !!span.tags && Object.keys(span.tags).length > 0;
}

export function Tags({node}: {node: TraceTreeNode<TraceTree.Span>}) {
  const span = node.value;
  const tags: {[tag_name: string]: string} | undefined = span?.tags;

  if (!tags) {
    return null;
  }

  const keys = Object.keys(tags);

  if (keys.length <= 0) {
    return null;
  }

  const items: SectionCardKeyValueList = keys.map(key => ({
    subject: key,
    value: String(tags[key]) || '',
    key,
    actionButton: (
      <TraceDrawerComponents.KeyValueAction
        rowKey={key}
        rowValue={String(tags[key]) || ''}
        kind={TraceDrawerActionValueKind.TAG}
        projectIds={node.event?.projectID}
      />
    ),
    actionButtonAlwaysVisible: true,
  }));

  return (
    <TraceDrawerComponents.SectionCard
      items={items}
      title={t('Tags')}
      sortAlphabetically
    />
  );
}
