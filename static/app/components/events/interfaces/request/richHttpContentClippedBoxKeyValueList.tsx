import ClippedBox from 'sentry/components/clippedBox';
import ErrorBoundary from 'sentry/components/errorBoundary';
import KeyValueList from 'sentry/components/events/interfaces/keyValueList';
import type {Meta} from 'sentry/types';
import type {EntryRequest} from 'sentry/types/event';
import {defined} from 'sentry/utils';

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
          data={transformedData
            .map(d => {
              const [key, value] = d.data;

              if (!value && !d.meta) {
                return null;
              }

              return {
                key,
                subject: key,
                value,
                meta: d.meta,
              };
            })
            .filter(defined)}
          isContextData={isContextData}
        />
      );
    } catch {
      // TODO(TS): Types indicate that data might be an object
      return <pre>{data as any}</pre>;
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
