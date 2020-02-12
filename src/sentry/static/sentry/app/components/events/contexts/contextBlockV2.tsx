import React from 'react';

import ErrorBoundary from 'app/components/errorBoundary';
import KeyValueList, {
  KeyValueListData,
} from 'app/components/events/interfaces/keyValueList/keyValueListV2';

type Props = {
  knownData: Array<KeyValueListData>;
};

const ContextBlock = ({knownData}: Props) => {
  if (knownData.length === 0) {
    return null;
  }

  return (
    <ErrorBoundary mini>
      <KeyValueList data={knownData} isSorted isContextData />
    </ErrorBoundary>
  );
};

export default ContextBlock;
