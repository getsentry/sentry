import type {RawSpanType} from 'sentry/components/events/interfaces/spans/types';
import {t} from 'sentry/locale';

import {type SectionCardKeyValueList, TraceDrawerComponents} from '../../styles';
import {TraceDrawerActionValueKind} from '../../utils';

export function hasSpanTags(span: RawSpanType) {
  return !!span.tags && Object.keys(span.tags).length > 0;
}

export function Tags({span}: {span: RawSpanType}) {
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
