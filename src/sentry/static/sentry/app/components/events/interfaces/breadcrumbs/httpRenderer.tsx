import React from 'react';
import omit from 'lodash/omit';

import CrumbTable from 'app/components/events/interfaces/breadcrumbs/crumbTable';
import SummaryLine from 'app/components/events/interfaces/breadcrumbs/summaryLine';
import ExternalLink from 'app/components/links/externalLink';
import {getMeta} from 'app/components/events/meta/metaProxy';
import {defined} from 'app/utils';
import {t} from 'app/locale';

import getBreadcrumbCustomRendererValue from './getBreadcrumbCustomRendererValue';
import {Crumb} from './types';

type Props = {
  crumb: Crumb;
};

const HttpRenderer = ({crumb}: Props) => {
  const {data} = crumb;

  const renderUrl = (url: any) => {
    if (typeof url === 'string') {
      return url.match(/^https?:\/\//) ? (
        <ExternalLink data-test-id="http-renderer-external-link" href={url}>
          {url}
        </ExternalLink>
      ) : (
        <em>{url}</em>
      );
    }

    try {
      return JSON.stringify(url);
    } catch (e) {
      return t('Invalid URL');
    }
  };

  return (
    <CrumbTable
      crumb={crumb}
      summary={
        <SummaryLine>
          <pre>
            <code>
              {defined(data?.method) &&
                getBreadcrumbCustomRendererValue({
                  value: <strong>{`${data.method} `}</strong>,
                  meta: getMeta(data, 'method'),
                })}
              {defined(data?.url) &&
                getBreadcrumbCustomRendererValue({
                  value: renderUrl(data.url),
                  meta: getMeta(data, 'url'),
                })}
              {defined(data?.status_code) &&
                getBreadcrumbCustomRendererValue({
                  value: (
                    <span data-test-id="http-renderer-status-code">{` [${data.status_code}]`}</span>
                  ),
                  meta: getMeta(data, 'status_code'),
                })}
            </code>
          </pre>
        </SummaryLine>
      }
      kvData={omit(data, ['method', 'url', 'status_code'])}
    />
  );
};

export default HttpRenderer;
