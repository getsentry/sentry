import React from 'react';
import omit from 'lodash/omit';

import ExternalLink from 'app/components/links/externalLink';
import {getMeta} from 'app/components/events/meta/metaProxy';
import {t} from 'app/locale';
import {defined} from 'app/utils';
import Highlight from 'app/components/highlight';
import AnnotatedText from 'app/components/events/meta/annotatedText';

import {BreadcrumbTypeHTTP} from '../types';
import Summary from './summary';

type Props = {
  searchTerm: string;
  breadcrumb: BreadcrumbTypeHTTP;
};

const Http = ({breadcrumb, searchTerm}: Props) => {
  const {data} = breadcrumb;

  const renderUrl = (url: any) => {
    if (typeof url === 'string') {
      const content = <Highlight text={searchTerm}>{url}</Highlight>;
      return url.match(/^https?:\/\//) ? (
        <ExternalLink data-test-id="http-renderer-external-link" href={url}>
          {content}
        </ExternalLink>
      ) : (
        <span>{content}</span>
      );
    }

    try {
      return <Highlight text={searchTerm}>{JSON.stringify(url)}</Highlight>;
    } catch {
      return t('Invalid URL');
    }
  };

  const statusCode = data?.status_code;

  return (
    <Summary
      kvData={omit(data, ['method', 'url', 'status_code'])}
      searchTerm={searchTerm}
    >
      {data?.method && (
        <AnnotatedText
          value={
            <strong>
              <Highlight text={searchTerm}>{`${data.method} `}</Highlight>
            </strong>
          }
          meta={getMeta(data, 'method')}
        />
      )}
      {data?.url && (
        <AnnotatedText value={renderUrl(data.url)} meta={getMeta(data, 'url')} />
      )}
      {defined(statusCode) && (
        <AnnotatedText
          value={
            <Highlight
              data-test-id="http-renderer-status-code"
              text={searchTerm}
            >{` [${statusCode}]`}</Highlight>
          }
          meta={getMeta(data, 'status_code')}
        />
      )}
    </Summary>
  );
};

export default Http;
