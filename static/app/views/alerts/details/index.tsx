import * as React from 'react';
import type {RouteComponentProps} from 'react-router';

import Feature from 'sentry/components/acl/feature';
import useOrganization from 'sentry/utils/useOrganization';

type Props = {
  children?: React.ReactNode;
} & RouteComponentProps<{organizationId: string; projectId: string}, {}>;

function RuleDetailsContainer({children}: Props) {
  const organization = useOrganization();
  return (
    <Feature organization={organization} features={['alert-rule-status-page']}>
      {children && React.isValidElement(children) ? children : null}
    </Feature>
  );
}

export default RuleDetailsContainer;
