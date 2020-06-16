import {RouteComponentProps} from 'react-router/lib/Router';
import React from 'react';

import {Organization} from 'app/types';
import Access from 'app/components/acl/access';
import Feature from 'app/components/acl/feature';

type Props = {
  organization: Organization;
  children: React.ReactNode;
} & RouteComponentProps<{organizationId: string; projectId: string}, {}>;

const ProjectAlerts = ({children, organization}: Props) => (
  <Access organization={organization} access={['project:write']}>
    {({hasAccess}) => (
      <Feature organization={organization} features={['incidents']}>
        {({hasFeature: hasMetricAlerts}) => (
          <Feature organization={organization} features={['create-from-discover']}>
            {({hasFeature: hasCreateFromDiscover}) => (
              <React.Fragment>
                {React.isValidElement(children) &&
                  React.cloneElement(children, {
                    organization,
                    canEditRule: hasAccess,
                    hasMetricAlerts,
                    hasCreateFromDiscover,
                  })}
              </React.Fragment>
            )}
          </Feature>
        )}
      </Feature>
    )}
  </Access>
);

export default ProjectAlerts;
