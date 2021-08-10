import ErrorBoundary from 'app/components/errorBoundary';
import KeyValueList from 'app/components/events/interfaces/keyValueList';
import {KeyValueListData} from 'app/types';

type Props = {
  data: KeyValueListData;
  isSorted?: boolean;
  raw?: boolean;
};

const ContextBlock = ({data, isSorted, raw = false}: Props) => {
  if (data.length === 0) {
    return null;
  }

  return (
    <ErrorBoundary mini>
      <KeyValueList isSorted={isSorted} data={data} raw={raw} isContextData />
    </ErrorBoundary>
  );
};

export default ContextBlock;
