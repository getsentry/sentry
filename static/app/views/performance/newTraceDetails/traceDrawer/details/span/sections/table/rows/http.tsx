import {Fragment} from 'react';
import qs from 'qs';

import type {RawSpanType} from 'sentry/components/events/interfaces/spans/types';
import {t} from 'sentry/locale';
import {safeURL} from 'sentry/utils/url/safeURL';

import {TraceDrawerComponents} from '../../../../styles';

export function SpanHTTPInfo({span}: {span: RawSpanType}) {
  if (span.op === 'http.client' && span.description) {
    const [method, url] = span.description.split(' ');

    const parsedURL = safeURL(url);
    const queryString = qs.parse(parsedURL?.search ?? '');

    return parsedURL ? (
      <Fragment>
        <TraceDrawerComponents.TableRow title={t('Status')}>
          {span.status || ''}
        </TraceDrawerComponents.TableRow>
        <TraceDrawerComponents.TableRow title={t('HTTP Method')}>
          {method}
        </TraceDrawerComponents.TableRow>
        <TraceDrawerComponents.TableRow title={t('URL')}>
          {parsedURL ? parsedURL?.origin + parsedURL?.pathname : 'failed to parse URL'}
        </TraceDrawerComponents.TableRow>
        <TraceDrawerComponents.TableRow title={t('Query')}>
          {parsedURL
            ? JSON.stringify(queryString, null, 2)
            : `failed to parse query string from ${url}`}
        </TraceDrawerComponents.TableRow>
      </Fragment>
    ) : null;
  }

  return null;
}
