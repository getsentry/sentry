import ClippedBox from 'sentry/components/clippedBox';
import ContextData from 'sentry/components/contextData';
import ErrorBoundary from 'sentry/components/errorBoundary';
import KeyValueList from 'sentry/components/events/interfaces/keyValueList';
import {t} from 'sentry/locale';
import {EntryRequest} from 'sentry/types/event';
import {defined} from 'sentry/utils';

import getTransformedData from './getTransformedData';

type Props = {
  data: EntryRequest['data']['data'];
  inferredContentType: EntryRequest['data']['inferredContentType'];
  meta?: Record<any, any>;
};

export function RichHttpContentClippedBoxBodySection({
  data,
  meta,
  inferredContentType,
}: Props) {
  if (!defined(data)) {
    return null;
  }

  function getContent() {
    switch (inferredContentType) {
      case 'application/json':
        return (
          <ContextData
            data-test-id="rich-http-content-body-context-data"
            data={data}
            preserveQuotes
          />
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
            <ContextData data={data} meta={meta} withAnnotatedText />
          </pre>
        );
    }
  }

  const content = getContent();

  if (!content) {
    return null;
  }

  return (
    <ClippedBox title={t('Body')} defaultClipped>
      <ErrorBoundary mini>{content}</ErrorBoundary>
    </ClippedBox>
  );
}
