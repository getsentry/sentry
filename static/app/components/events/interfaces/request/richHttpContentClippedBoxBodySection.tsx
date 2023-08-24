import ClippedBox from 'sentry/components/clippedBox';
import ContextData from 'sentry/components/contextData';
import ErrorBoundary from 'sentry/components/errorBoundary';
import KeyValueList from 'sentry/components/events/interfaces/keyValueList';
import type {MetaContainer} from 'sentry/components/events/meta/metaContainer';
import {t} from 'sentry/locale';
import {EntryRequest} from 'sentry/types/event';
import {defined} from 'sentry/utils';

import getTransformedData from './getTransformedData';

type Props = {
  data: EntryRequest['data']['data'];
  inferredContentType: EntryRequest['data']['inferredContentType'];
  meta?: MetaContainer;
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
            meta={meta}
            withAnnotatedText
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

      default: {
        // FIXME: Is the test case in static/app/components/events/interfaces/request/index.spec.tsx accurate?
        // `EntryRequest['data']['data']` suggests that data may be [key: string, value: any][], **not** Record<string, any>[].
        // If this is a real scenario, what is the rule for looking up the relevant data in meta? As a hack, I assume that if
        // we encounter data as an array, that the same meta structure can be used by all items... which allows the test case
        // to pass.
        const wrappedMeta = Array.isArray(data)
          ? Object.fromEntries(data.map((_: any, i: number) => [i, meta]))
          : meta;
        return (
          <pre data-test-id="rich-http-content-body-section-pre">
            <ContextData data={data} meta={wrappedMeta} withAnnotatedText />
          </pre>
        );
      }
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
