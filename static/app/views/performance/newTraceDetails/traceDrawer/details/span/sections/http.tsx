import * as qs from 'query-string';

import type {RawSpanType} from 'sentry/components/events/interfaces/spans/types';
import {t} from 'sentry/locale';
import {safeURL} from 'sentry/utils/url/safeURL';

import {type SectionCardKeyValueList, TraceDrawerComponents} from '../../styles';

export function hasSpanHTTPInfo(span: RawSpanType) {
  if (span.op !== 'http.client' || !span.description) {
    return false;
  }

  const [_, url] = span.description.split(' ');
  const parsedURL = safeURL(url!);

  return !!parsedURL;
}

export function SpanHTTPInfo({span}: {span: RawSpanType}) {
  if (span.op === 'http.client' && span.description) {
    const [method, url] = span.description.split(' ');

    const parsedURL = safeURL(url!);
    const queryString = qs.parse(parsedURL?.search ?? '');

    if (!parsedURL) {
      return null;
    }

    const items: SectionCardKeyValueList = [
      {
        subject: t('Status'),
        value: span.status || '',
        key: 'status',
      },
      {
        subject: t('HTTP Method'),
        value: method,
        key: 'method',
      },
      {
        subject: t('URL'),
        value: parsedURL
          ? parsedURL?.origin + parsedURL?.pathname
          : 'failed to parse URL',
        key: 'url',
      },
      {
        subject: t('Query'),
        value: parsedURL
          ? JSON.stringify(queryString, null, 2)
          : `failed to parse query string from ${url}`,
        key: 'query',
      },
    ];

    return parsedURL ? (
      <TraceDrawerComponents.SectionCard
        items={items}
        title={t('Http')}
        sortAlphabetically
      />
    ) : null;
  }

  return null;
}
