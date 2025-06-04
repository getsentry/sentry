import ClippedBox from 'sentry/components/clippedBox';
import ErrorBoundary from 'sentry/components/errorBoundary';
import KeyValueList from 'sentry/components/events/interfaces/keyValueList';
import StructuredEventData from 'sentry/components/structuredEventData';
import {JsonEventData} from 'sentry/components/structuredEventData/jsonEventData';
import {t} from 'sentry/locale';
import type {EntryRequest} from 'sentry/types/event';
import {defined} from 'sentry/utils';

import getTransformedData from './getTransformedData';

type Props = {
  data: EntryRequest['data']['data'];
  inferredContentType: EntryRequest['data']['inferredContentType'];
  meta?: Record<any, any>;
};

export function getBodyContent({data, meta, inferredContentType}: Props) {
  switch (inferredContentType) {
    case 'application/json':
      return (
        <JsonEventData data-test-id="rich-http-content-body-context-data" data={data} />
      );
    case 'application/x-www-form-urlencoded':
    case 'multipart/form-data': {
      const transformedData = getTransformedData(data, meta).map(d => {
        const [key, value] = d.data;
        return {
          key,
          subject: key,
          value,
          meta: d.meta,
        };
      });

      if (!transformedData.length) {
        return null;
      }

      return (
        <KeyValueList
          data-test-id="rich-http-content-body-key-value-list"
          data={transformedData}
          isContextData
        />
      );
    }

    default:
      return (
        <pre data-test-id="rich-http-content-body-section-pre">
          <StructuredEventData data={data} meta={meta} withAnnotatedText />
        </pre>
      );
  }
}

export function RichHttpContentClippedBoxBodySection({
  data,
  meta,
  inferredContentType,
}: Props) {
  if (!defined(data)) {
    return null;
  }

  const content = getBodyContent({data, meta, inferredContentType});

  if (!content) {
    return null;
  }

  return (
    <ClippedBox title={t('Body')} defaultClipped>
      <ErrorBoundary mini>{content}</ErrorBoundary>
    </ClippedBox>
  );
}
