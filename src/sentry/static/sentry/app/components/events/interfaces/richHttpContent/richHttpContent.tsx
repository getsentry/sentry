import React from 'react';

import {getMeta} from 'app/components/events/meta/metaProxy';
import {defined} from 'app/utils';
import {t} from 'app/locale';
import ClippedBox from 'app/components/clippedBox';
import ErrorBoundary from 'app/components/errorBoundary';

import RichHttpContentClippedBoxKeyValueList from './richHttpContentClippedBoxKeyValueList';
import RichHttpContentClippedBoxBodySection from './richHttpContentClippedBoxBodySection';

type Props = {
  data: Data;
};

type Data = {
  headers?: any;
  query?: any;
  env?: any;
  fragment?: any;
  cookies?: any;
  data?: any;
};

const RichHttpContent = ({data}: Props) => (
  <React.Fragment>
    {defined(data.query) && (
      <RichHttpContentClippedBoxKeyValueList
        title={t('Query String')}
        data={data.query}
        meta={getMeta(data, 'query')}
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
        meta={getMeta(data, 'data')}
      />
    )}
    {defined(data.cookies) && Object.keys(data.cookies).length > 0 && (
      <RichHttpContentClippedBoxKeyValueList
        defaultCollapsed
        title={t('Cookies')}
        data={data.cookies}
        meta={getMeta(data, 'cookies')}
      />
    )}
    {defined(data.headers) && (
      <RichHttpContentClippedBoxKeyValueList
        title={t('Headers')}
        data={data.headers}
        meta={getMeta(data, 'headers')}
      />
    )}
    {defined(data.env) && (
      <RichHttpContentClippedBoxKeyValueList
        defaultCollapsed
        title={t('Environment')}
        data={data.env}
        meta={getMeta(data, 'env')}
      />
    )}
  </React.Fragment>
);

export default RichHttpContent;
