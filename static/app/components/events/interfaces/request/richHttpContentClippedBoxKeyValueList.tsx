import ClippedBox from 'sentry/components/clippedBox';
import ErrorBoundary from 'sentry/components/errorBoundary';
import KeyValueList from 'sentry/components/events/interfaces/keyValueList';
import {Meta} from 'sentry/types';
import {EntryRequest} from 'sentry/types/event';

import getTransformedData from './getTransformedData';

type Data = EntryRequest['data']['data'];

type Props = {
  data: Data;
  title: string;
  defaultCollapsed?: boolean;
  isContextData?: boolean;
  meta?: Meta;
};

export function RichHttpContentClippedBoxKeyValueList({
  data,
  title,
  defaultCollapsed = false,
  isContextData = false,
  meta,
}: Props) {
  const transformedData = getTransformedData(data, meta);

  function getContent() {
    // Sentry API abbreviates long query string values, sometimes resulting in
    // an un-parsable querystring ... stay safe kids
    try {
      return (
        <KeyValueList
          data={transformedData.map(d => {
            const [key, value] = d.data;
            return {
              key,
              subject: key,
              value,
              meta: d.meta,
            };
          })}
          isContextData={isContextData}
        />
      );
    } catch {
      return <pre>{data}</pre>;
    }
  }

  if (!transformedData.length) {
    return null;
  }

  return (
    <ClippedBox title={title} defaultClipped={defaultCollapsed}>
      <ErrorBoundary mini>{getContent()}</ErrorBoundary>
    </ClippedBox>
  );
}
