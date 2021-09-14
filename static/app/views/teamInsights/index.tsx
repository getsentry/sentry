import {cloneElement, Fragment, isValidElement} from 'react';

import Feature from 'app/components/acl/feature';
import {Organization} from 'app/types';
import withOrganization from 'app/utils/withOrganization';

type Props = {
  organization: Organization;
  children?: React.ReactNode;
};

function TeamInsightsContainer({children, organization}: Props) {
  return (
    <Feature organization={organization} features={['team-insights']}>
      <Fragment>
        {children && isValidElement(children)
          ? cloneElement(children, {
              organization,
            })
          : children}
      </Fragment>
    </Feature>
  );
}

export default withOrganization(TeamInsightsContainer);
