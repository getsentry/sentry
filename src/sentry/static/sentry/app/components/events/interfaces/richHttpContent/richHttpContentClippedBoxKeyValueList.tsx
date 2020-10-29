import React from 'react';

import ErrorBoundary from 'app/components/errorBoundary';
import ClippedBox from 'app/components/clippedBox';
import KeyValueList from 'app/components/events/interfaces/keyValueList/keyValueListV2';
import {Meta} from 'app/types';

import getTransformedData from './getTransformedData';
import {Data} from './types';

type Props = {
  title: string;
  data: Data[keyof Data];
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
  const getContent = (transformedData: Array<[string, string]>) => {
    // Sentry API abbreviates long query string values, sometimes resulting in
    // an un-parsable querystring ... stay safe kids
    try {
      return (
        <KeyValueList
          data={transformedData.map(([key, value]) => ({
            key,
            subject: key,
            value,
            meta,
          }))}
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
    <ClippedBox title={title} defaultClipped={defaultCollapsed}>
      <ErrorBoundary mini>{getContent(transformedData)}</ErrorBoundary>
    </ClippedBox>
  );
};

export default RichHttpContentClippedBoxKeyValueList;
