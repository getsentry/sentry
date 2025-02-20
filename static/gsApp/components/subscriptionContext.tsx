import {Fragment} from 'react';

import useOrganization from 'sentry/utils/useOrganization';

import ContactBillingMembers from 'getsentry/views/contactBillingMembers';

type Props = {
  children?: React.ReactNode;
};

function SubscriptionContext(props: Props) {
  const organization = useOrganization();
  return organization.access.includes('org:billing') ? (
    <Fragment>{props.children}</Fragment>
  ) : (
    <ContactBillingMembers />
  );
}

export default SubscriptionContext;
