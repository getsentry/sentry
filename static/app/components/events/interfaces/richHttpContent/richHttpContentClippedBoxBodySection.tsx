import ClippedBox from 'app/components/clippedBox';
import ContextData from 'app/components/contextData';
import ErrorBoundary from 'app/components/errorBoundary';
import KeyValueList from 'app/components/events/interfaces/keyValueList';
import AnnotatedText from 'app/components/events/meta/annotatedText';
import {t} from 'app/locale';
import {Meta} from 'app/types';
import {EntryRequest} from 'app/types/event';
import {defined} from 'app/utils';

import getTransformedData from './getTransformedData';

type Props = {
  data: EntryRequest['data']['data'];
  inferredContentType: EntryRequest['data']['inferredContentType'];
  meta?: Meta;
};

function RichHttpContentClippedBoxBodySection({data, meta, inferredContentType}: Props) {
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
        const transformedData = getTransformedData(data).map(([key, v]) => ({
          key,
          subject: key,
          value: v,
          meta,
        }));

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
            <AnnotatedText
              value={data && JSON.stringify(data, null, 2)}
              meta={meta}
              data-test-id="rich-http-content-body-context-data"
            />
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

export default RichHttpContentClippedBoxBodySection;
