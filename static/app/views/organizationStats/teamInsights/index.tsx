import {cloneElement, isValidElement} from 'react';

import Feature from 'sentry/components/acl/feature';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import {Organization} from 'sentry/types';
import withOrganization from 'sentry/utils/withOrganization';

type Props = {
  organization: Organization;
  children?: React.ReactNode;
};

function TeamInsightsContainer({children, organization}: Props) {
  return (
    <Feature organization={organization} features="team-insights">
      <NoProjectMessage organization={organization}>
        {children && isValidElement(children)
          ? cloneElement<any>(children, {
              organization,
            })
          : (children as React.ReactChild)}
      </NoProjectMessage>
    </Feature>
  );
}

export default withOrganization(TeamInsightsContainer);
