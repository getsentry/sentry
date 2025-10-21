import type {RawSpanType} from 'sentry/components/events/interfaces/spans/types';
import {t} from 'sentry/locale';
import {
  TraceDrawerComponents,
  type SectionCardKeyValueList,
} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/styles';
import {TraceDrawerActionValueKind} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/utils';
import type {SpanNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/spanNode';

export function hasSpanTags(span: RawSpanType) {
  return !!span.tags && Object.keys(span.tags).length > 0;
}

export function Tags({node}: {node: SpanNode}) {
  const span = node.value;
  const tags: Record<string, string> | undefined = span?.tags;

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
