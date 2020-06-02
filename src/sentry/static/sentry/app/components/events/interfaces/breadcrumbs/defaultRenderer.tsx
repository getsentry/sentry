import React from 'react';

import CrumbTable from 'app/components/events/interfaces/breadcrumbs/crumbTable';
import SummaryLine from 'app/components/events/interfaces/breadcrumbs/summaryLine';

import {BreadcrumbTypeDefault, BreadcrumbTypeNavigation} from './types';

type Props = {
  breadcrumb: BreadcrumbTypeDefault | BreadcrumbTypeNavigation;
};

const DefaultRenderer = ({breadcrumb}: Props) => (
  <CrumbTable
    breadcrumb={breadcrumb}
    summary={
      <SummaryLine>
        {breadcrumb?.message && (
          <pre>
            <code>{breadcrumb.message}</code>
          </pre>
        )}
      </SummaryLine>
    }
    kvData={breadcrumb.data}
  />
);

export default DefaultRenderer;
