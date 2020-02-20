import React from 'react';
import omit from 'lodash/omit';

import CrumbTable from 'app/components/events/interfaces/breadcrumbs/crumbTable';
import SummaryLine from 'app/components/events/interfaces/breadcrumbs/summaryLine';
import {getMeta} from 'app/components/events/meta/metaProxy';
import {defined} from 'app/utils';

import getBreadcrumbCustomRendererValue from './getBreadcrumbCustomRendererValue';
import {Crumb} from './types';

type Props = {
  crumb: Crumb;
};

const ErrorRenderer = ({crumb}: Props) => {
  const {data} = crumb;
  return (
    <CrumbTable
      crumb={crumb}
      summary={
        <SummaryLine>
          <pre>
            <code>
              {defined(data?.type) &&
                getBreadcrumbCustomRendererValue({
                  value: <strong>{`${data.type}: `}</strong>,
                  meta: getMeta(data, 'type'),
                })}
              {defined(data?.value) &&
                getBreadcrumbCustomRendererValue({
                  value: crumb.message ? `${data.value}. ` : data.value,
                  meta: getMeta(data, 'value'),
                })}
              {defined(crumb?.message) &&
                getBreadcrumbCustomRendererValue({
                  value: crumb.message,
                  meta: getMeta(crumb, 'message'),
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
