import {RouteComponentProps} from 'react-router/lib/Router';
import React from 'react';

import {Organization} from 'app/types';
import Access from 'app/components/acl/access';
import Feature from 'app/components/acl/feature';

type Props = {
  organization: Organization;
  children: React.ReactNode;
} & RouteComponentProps<{organizationId: string; projectId: string}, {}>;

const ProjectAlerts = ({children, organization}: Props) => {
  const hasCreateFromDiscover = organization.features.includes('create-from-discover');

  return (
    <Access organization={organization} access={['project:write']}>
      {({hasAccess}) => (
        <Feature organization={organization} features={['incidents']}>
          {({hasFeature}) => (
            <React.Fragment>
              {React.isValidElement(children) &&
                React.cloneElement(children, {
                  organization,
                  canEditRule: hasAccess,
                  hasMetricAlerts: hasFeature,
                  hasCreateFromDiscover,
                })}
            </React.Fragment>
          )}
        </Feature>
      )}
    </Access>
  );
};

export default ProjectAlerts;
