import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {KeyValue} from 'sentry/components/keyValue';
import type {KeyValueListData} from 'sentry/types/group';

type Props = {
  data: KeyValueListData;
  raw?: boolean;
};

export function ContextBlock({data, raw = false}: Props) {
  if (data.length === 0) {
    return null;
  }

  return (
    <ErrorBoundary mini>
      <KeyValue
        items={
          raw ? data.map(item => ({...item, value: JSON.stringify(item.value)})) : data
        }
        layout="detail"
        sort="key"
        valueDisplay="expandable"
      />
    </ErrorBoundary>
  );
}
