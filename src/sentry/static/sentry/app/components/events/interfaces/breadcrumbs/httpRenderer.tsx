import React from 'react';

import CrumbTable from 'app/components/events/interfaces/breadcrumbs/crumbTable';
import SummaryLine from 'app/components/events/interfaces/breadcrumbs/summaryLine';
import {getMeta} from 'app/components/events/meta/metaProxy';
import {filterProps} from 'app/utils';
import {t} from 'app/locale';

import BreadcrumbCustomRendererValue from './breadcrumbCustomRendererValue';
import {Crumb} from './types';

type Props = {
  crumb: Crumb;
};

const HttpRenderer = ({crumb}: Props) => {
  const {data} = crumb;

  const renderUrl = (url: any) => {
    if (typeof url === 'string') {
      return url.match(/^https?:\/\//) ? <a href={url}>{url}</a> : <em>{url}</em>;
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
              {data.method && (
                <BreadcrumbCustomRendererValue
                  value={<strong>{data.method}</strong>}
                  meta={getMeta(data, 'method')}
                />
              )}
              {data.url && (
                <BreadcrumbCustomRendererValue
                  value={renderUrl(data.url)}
                  meta={getMeta(data, 'url')}
                />
              )}
              {data.status_code && (
                <BreadcrumbCustomRendererValue
                  value={<span>{` [${data.status_code}]`}</span>}
                  meta={getMeta(data, 'status_code')}
                />
              )}
            </code>
          </pre>
        </SummaryLine>
      }
      kvData={filterProps(data, ['method', 'url', 'status_code'])}
    />
  );
};

export default HttpRenderer;
