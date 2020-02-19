import React from 'react';

import ErrorBoundary from 'app/components/errorBoundary';
import KeyValueList from 'app/components/events/interfaces/keyValueList/keyValueListV2';
import {KeyValueListData} from 'app/components/events/interfaces/keyValueList/types';

type Props = {
  knownData: Array<KeyValueListData>;
  raw?: boolean;
};

const ContextBlock = ({knownData, raw = false}: Props) => {
  if (knownData.length === 0) {
    return null;
  }

  return (
    <ErrorBoundary mini>
      <KeyValueList data={knownData} raw={raw} isContextData />
    </ErrorBoundary>
  );
};

export default ContextBlock;
