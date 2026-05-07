import {Fragment} from 'react';

import {CustomerGrid} from 'admin/components/customerGrid';
import {PageHeader} from 'admin/components/pageHeader';

export function Customers() {
  return (
    <Fragment>
      <PageHeader title="Customers" />
      <CustomerGrid endpoint="/customers/" />
    </Fragment>
  );
}
