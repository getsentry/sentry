import React from 'react';
import omit from 'lodash/omit';

import CrumbTable from 'app/components/events/interfaces/breadcrumbs/crumbTable';
import SummaryLine from 'app/components/events/interfaces/breadcrumbs/summaryLine';
import {defined} from 'app/utils';

import {BreadcrumbTypeDefault} from './types';

type Props = {
  breadcrumb: BreadcrumbTypeDefault;
};

const ErrorRenderer = ({breadcrumb}: Props) => {
  const {data} = breadcrumb;

  const renderDataValue = (value: any) => {
    if (breadcrumb?.message) {
      return `${value}. `;
    }
    return value;
  };

  return (
    <CrumbTable
      breadcrumb={breadcrumb}
      summary={
        <SummaryLine>
          <pre>
            <code>
              {data?.type && <strong>{`${data.type}: `}</strong>}
              {defined(data) && defined(data?.value) && renderDataValue(data.value)}
              {breadcrumb.message}
            </code>
          </pre>
        </SummaryLine>
      }
      kvData={omit(data, ['type', 'value'])}
    />
  );
};

export default ErrorRenderer;
