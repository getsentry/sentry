import {Fragment} from 'react';

import {Heading} from '@sentry/scraps/text';

import {PageHeader} from 'admin/components/pageHeader';
import {InvoiceComparison} from 'admin/views/invoiceComparison';

export function BillingPlatform() {
  return (
    <Fragment>
      <PageHeader title="Billing Platform" />
      <Heading as="h3">Invoice Comparison</Heading>
      <InvoiceComparison />
    </Fragment>
  );
}
