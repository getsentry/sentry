import {Fragment, useState} from 'react';

import {CompactSelect} from '@sentry/scraps/compactSelect';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {useParams} from 'sentry/utils/useParams';

import {CustomerContract} from 'admin/components/customers/customerContract';
import {CustomerTrial} from 'admin/components/customers/customerTrial';
import {PageHeader} from 'admin/components/pageHeader';

export function CustomerPlatformView() {
  const {orgId} = useParams<{orgId: string}>();
  const [activeView, setActiveView] = useState<'contract' | 'trial'>('contract');

  return (
    <Fragment>
      <PageHeader title="Customers" breadcrumbs={[orgId, 'Platform View']}>
        <CompactSelect
          trigger={triggerProps => (
            <OverlayTrigger.Button {...triggerProps} prefix="View" />
          )}
          value={activeView}
          options={[
            {label: 'Contract', value: 'contract'},
            {label: 'Trial', value: 'trial'},
          ]}
          onChange={opt => setActiveView(opt.value)}
        />
      </PageHeader>
      {activeView === 'contract' ? (
        <CustomerContract orgId={orgId} />
      ) : (
        <CustomerTrial orgId={orgId} />
      )}
    </Fragment>
  );
}
