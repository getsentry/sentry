import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {KeyValueTableDataList} from 'sentry/components/tables/keyValueTable';
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
      <KeyValueTableDataList data={data} raw={raw} isContextData />
    </ErrorBoundary>
  );
}
