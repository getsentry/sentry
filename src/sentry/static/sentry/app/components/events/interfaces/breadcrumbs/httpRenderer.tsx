import React from 'react';
import omit from 'lodash/omit';

import CrumbTable from 'app/components/events/interfaces/breadcrumbs/crumbTable';
import SummaryLine from 'app/components/events/interfaces/breadcrumbs/summaryLine';
import ExternalLink from 'app/components/links/externalLink';
import {t} from 'app/locale';
import {defined} from 'app/utils';

import {BreadcrumbTypeHTTP} from './types';

type Props = {
  breadcrumb: BreadcrumbTypeHTTP;
};

const HttpRenderer = ({breadcrumb}: Props) => {
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
    <CrumbTable
      breadcrumb={breadcrumb}
      summary={
        <SummaryLine>
          <pre>
            <code>
              {data?.method && <strong>{`${data.method} `}</strong>}
              {data?.url && renderUrl(data.url)}
              {defined(data) && defined(data.status_code) && (
                <span data-test-id="http-renderer-status-code">{` [${data.status_code}]`}</span>
              )}
            </code>
          </pre>
        </SummaryLine>
      }
      kvData={omit(data, ['method', 'url', 'status_code'])}
    />
  );
};

export default HttpRenderer;
