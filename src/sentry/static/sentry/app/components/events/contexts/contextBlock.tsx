import ErrorBoundary from 'app/components/errorBoundary';
import KeyValueList from 'app/components/events/interfaces/keyValueList/keyValueListV2';
import {KeyValueListData} from 'app/components/events/interfaces/keyValueList/types';

type Props = {
  data: Array<KeyValueListData>;
  raw?: boolean;
};

const ContextBlock = ({data, raw = false}: Props) => {
  if (data.length === 0) {
    return null;
  }

  return (
    <ErrorBoundary mini>
      <KeyValueList data={data} raw={raw} isContextData />
    </ErrorBoundary>
  );
};

export default ContextBlock;
