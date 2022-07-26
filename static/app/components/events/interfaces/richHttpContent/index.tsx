import {Fragment} from 'react';

import ClippedBox from 'sentry/components/clippedBox';
import ErrorBoundary from 'sentry/components/errorBoundary';
import {t} from 'sentry/locale';
import {Project} from 'sentry/types';
import {EntryRequest, Event} from 'sentry/types/event';
import {defined} from 'sentry/utils';

import RichHttpContentClippedBoxBodySection from './richHttpContentClippedBoxBodySection';
import RichHttpContentClippedBoxKeyValueList from './richHttpContentClippedBoxKeyValueList';

type Props = {
  data: EntryRequest['data'];
  meta: Event['_meta'];
};

export function RichHttpContent({data, meta}: Props) {
  console.log({meta2: meta?.['0']?.data});
  return (
    <Fragment>
      {defined(data.query) && (
        <RichHttpContentClippedBoxKeyValueList
          title={t('Query String')}
          data={data.query}
          meta={meta?.query?.['']}
          isContextData
        />
      )}
      {defined(data.fragment) && (
        <ClippedBox title={t('Fragment')}>
          <ErrorBoundary mini>
            <pre>{data.fragment}</pre>
          </ErrorBoundary>
        </ClippedBox>
      )}
      {defined(data.data) && (
        <RichHttpContentClippedBoxBodySection
          data={data.data}
          meta={meta?.data?.['']}
          inferredContentType={data.inferredContentType}
        />
      )}
      {defined(data.cookies) && Object.keys(data.cookies).length > 0 && (
        <RichHttpContentClippedBoxKeyValueList
          defaultCollapsed
          title={t('Cookies')}
          data={data.cookies}
          meta={meta?.cookies?.['']}
        />
      )}
      {defined(data.headers) && (
        <RichHttpContentClippedBoxKeyValueList
          title={t('Headers')}
          data={data.headers}
          meta={meta?.['0']?.data?.headers?.['0']}
        />
      )}
      {defined(data.env) && (
        <RichHttpContentClippedBoxKeyValueList
          defaultCollapsed
          title={t('Environment')}
          data={data.env}
          meta={meta?.env?.['']}
        />
      )}
    </Fragment>
  );
}
