import ClippedBox from 'sentry/components/clippedBox';
import ErrorBoundary from 'sentry/components/errorBoundary';
import KeyValueList from 'sentry/components/events/interfaces/keyValueList';
import {Meta} from 'sentry/types';
import {EntryRequest} from 'sentry/types/event';

import getTransformedData from './getTransformedData';

type Data = EntryRequest['data']['data'];

type Props = {
  title: string;
  data: Data;
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

  if (!transformedData.length) {
    return null;
  }

  return (
    <ClippedBox title={title} defaultClipped={defaultCollapsed}>
      <ErrorBoundary mini>{getContent(transformedData)}</ErrorBoundary>
    </ClippedBox>
  );
};

export default RichHttpContentClippedBoxKeyValueList;
