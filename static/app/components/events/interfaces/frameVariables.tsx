import * as React from 'react';
import omit from 'lodash/omit';

import KeyValueList from 'app/components/events/interfaces/keyValueList';
import {getMeta} from 'app/components/events/meta/metaProxy';
import {KeyValueListData} from 'app/types';

type Props = {
  data: Record<string, any>;
};

const FrameVariables = ({data}: Props) => {
  // make sure that clicking on the variables does not actually do
  // anything on the containing element.
  const handlePreventToggling = () => (event: React.MouseEvent<HTMLTableElement>) => {
    event.stopPropagation();
  };

  const getTransformedData = (): KeyValueListData => {
    const transformedData: KeyValueListData = [];

    const dataKeys = Object.keys(data).sort((a, b) => {
      return data[a]._order - data[b]._order;
    });
    for (const key of dataKeys) {
      transformedData.push({
        key,
        subject: key,
        value: omit(data[key], ['_order']),
        meta: getMeta(data, key),
      });
    }
    return transformedData;
  };

  const transformedData = getTransformedData();

  return (
    <KeyValueList
      data={transformedData}
      onClick={handlePreventToggling}
      isContextData
      isSorted={Object.keys(data).some(key => data[key]._order) ? false : true}
    />
  );
};

export default FrameVariables;
