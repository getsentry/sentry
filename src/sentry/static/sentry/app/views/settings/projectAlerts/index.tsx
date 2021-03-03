import React from 'react';
import {RouteComponentProps} from 'react-router';

import Access from 'app/components/acl/access';
import Feature from 'app/components/acl/feature';
import {Organization} from 'app/types';

type Props = {
  organization: Organization;
  children: React.ReactNode;
} & RouteComponentProps<{organizationId: string; projectId: string}, {}>;

const ProjectAlerts = ({children, organization}: Props) => (
  <Access organization={organization} access={['project:write']}>
    {({hasAccess}) => (
      <Feature organization={organization} features={['incidents']}>
        {({hasFeature: hasMetricAlerts}) => (
          <React.Fragment>
            {React.isValidElement(children) &&
              React.cloneElement(children, {
                organization,
                canEditRule: hasAccess,
                hasMetricAlerts,
              })}
          </React.Fragment>
        )}
      </Feature>
    )}
  </Access>
);

export default ProjectAlerts;
