import ErrorBoundary from 'sentry/components/errorBoundary';
import KeyValueList from 'sentry/components/events/interfaces/keyValueList';
import {KeyValueListData} from 'sentry/types';

type Props = {
  data: KeyValueListData;
  raw?: boolean;
};

function ContextBlock({data, raw = false}: Props) {
  if (data.length === 0) {
    return null;
  }

  return (
    <ErrorBoundary mini>
      <KeyValueList data={data} raw={raw} isContextData />
    </ErrorBoundary>
  );
}

export default ContextBlock;
