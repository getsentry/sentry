import React from 'react';

import CrumbTable from 'app/components/events/interfaces/breadcrumbs/crumbTable';
import SummaryLine from 'app/components/events/interfaces/breadcrumbs/summaryLine';
import {getMeta} from 'app/components/events/meta/metaProxy';
import {filterProps} from 'app/utils';

import BreadcrumbCustomRendererValue from './breadcrumbCustomRendererValue';
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
              {data.type && (
                <BreadcrumbCustomRendererValue
                  value={<strong>{`${data.type}: `}</strong>}
                  meta={getMeta(data, 'type')}
                />
              )}
              {data.value && (
                <BreadcrumbCustomRendererValue
                  value={crumb.message ? `${data.value}. ` : data.value}
                  meta={getMeta(data, 'value')}
                />
              )}
              {crumb.message && (
                <BreadcrumbCustomRendererValue
                  value={crumb.message}
                  meta={getMeta(crumb, 'message')}
                />
              )}
            </code>
          </pre>
        </SummaryLine>
      }
      kvData={filterProps(data, ['type', 'value'])}
    />
  );
};

export default ErrorRenderer;
