import React from 'react';

import ErrorBoundary from 'app/components/errorBoundary';
import ClippedBox from 'app/components/clippedBox';
import KeyValueList from 'app/components/events/interfaces/keyValueList/keyValueListV2';
import {Meta} from 'app/types';

import getTransformedData from './getTransformedData';

type Props = {
  title: string;
  data: any;
  defaultCollapsed?: boolean;
  isContextData?: boolean;
  meta?: Meta;
};

const RichHttpContentClippedBoxKeyValueList = ({
  data,
  title,
  defaultCollapsed = false,
  isContextData = false,
  meta,
}: Props) => {
  const getContent = () => {
    // Sentry API abbreviates long query string values, sometimes resulting in
    // an un-parsable querystring ... stay safe kids
    try {
      return (
        <KeyValueList
          data={data.map(([key, value]) => ({key, value, meta}))}
          isContextData={isContextData}
        />
      );
    } catch {
      return <pre>{data}</pre>;
    }
  };

  const transformedData = getTransformedData(data);

  if (transformedData.length === 0) {
    return null;
  }

  return (
    <ClippedBox title={title} defaultCollapsed={defaultCollapsed}>
      <ErrorBoundary mini>{getContent()}</ErrorBoundary>
    </ClippedBox>
  );
};

export default RichHttpContentClippedBoxKeyValueList;
