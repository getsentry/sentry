import React from 'react';
import omit from 'lodash/omit';

import CrumbTable from 'app/components/events/interfaces/breadcrumbs/crumbTable';
import SummaryLine from 'app/components/events/interfaces/breadcrumbs/summaryLine';
import {getMeta} from 'app/components/events/meta/metaProxy';
import {defined} from 'app/utils';

import getBreadcrumbCustomRendererValue from './getBreadcrumbCustomRendererValue';
import {BreadcrumbTypeDefault} from './types';

type Props = {
  breadcrumb: BreadcrumbTypeDefault;
};

const ErrorRenderer = ({breadcrumb}: Props) => {
  const {data} = breadcrumb;
  return (
    <CrumbTable
      breadcrumb={breadcrumb}
      summary={
        <SummaryLine>
          <pre>
            <code>
              {data?.type &&
                getBreadcrumbCustomRendererValue({
                  value: <strong>{`${data.type}: `}</strong>,
                  meta: getMeta(data, 'type'),
                })}
              {defined(data) &&
                defined(data?.value) &&
                getBreadcrumbCustomRendererValue({
                  value: breadcrumb?.message ? `${data.value}. ` : data.value,
                  meta: getMeta(data, 'value'),
                })}
              {breadcrumb?.message &&
                getBreadcrumbCustomRendererValue({
                  value: breadcrumb.message,
                  meta: getMeta(breadcrumb, 'message'),
                })}
            </code>
          </pre>
        </SummaryLine>
      }
      kvData={omit(data, ['type', 'value'])}
    />
  );
};

export default ErrorRenderer;
