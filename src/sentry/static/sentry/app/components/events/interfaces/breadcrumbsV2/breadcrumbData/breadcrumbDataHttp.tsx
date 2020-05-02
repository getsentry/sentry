import React from 'react';
import omit from 'lodash/omit';

import ExternalLink from 'app/components/links/externalLink';
import {getMeta} from 'app/components/events/meta/metaProxy';
import {t} from 'app/locale';
import {defined} from 'app/utils';

import getBreadcrumbCustomRendererValue from '../../breadcrumbs/getBreadcrumbCustomRendererValue';
import {BreadcrumbTypeHTTP} from '../../breadcrumbs/types';
import BreadcrumbDataSummary from './breadcrumbDataSummary';

type Props = {
  breadcrumb: BreadcrumbTypeHTTP;
};

const BreadcrumbDataHttp = ({breadcrumb}: Props) => {
  const {data} = breadcrumb;

  const renderUrl = (url: any) => {
    if (typeof url === 'string') {
      return url.match(/^https?:\/\//) ? (
        <ExternalLink data-test-id="http-renderer-external-link" href={url}>
          {url}
        </ExternalLink>
      ) : (
        <span>{url}</span>
      );
    }

    try {
      return JSON.stringify(url);
    } catch {
      return t('Invalid URL');
    }
  };

  return (
    <BreadcrumbDataSummary kvData={omit(data, ['method', 'url', 'status_code'])}>
      {data?.method &&
        getBreadcrumbCustomRendererValue({
          value: <strong>{`${data.method} `}</strong>,
          meta: getMeta(data, 'method'),
        })}
      {data?.url &&
        getBreadcrumbCustomRendererValue({
          value: renderUrl(data.url),
          meta: getMeta(data, 'url'),
        })}
      {defined(data) &&
        defined(data.status_code) &&
        getBreadcrumbCustomRendererValue({
          value: (
            <span data-test-id="http-renderer-status-code">{` [${data.status_code}]`}</span>
          ),
          meta: getMeta(data, 'status_code'),
        })}
    </BreadcrumbDataSummary>
  );
};

export default BreadcrumbDataHttp;
