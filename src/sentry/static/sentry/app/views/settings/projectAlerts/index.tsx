import {RouteComponentProps} from 'react-router/lib/Router';
import React from 'react';

import {Organization} from 'app/types';
import Access from 'app/components/acl/access';
import Feature from 'app/components/acl/feature';

import ProjectAlertHeader from './projectAlertHeaderNew';

type Props = {
  organization: Organization;
  children: React.ReactNode;
} & RouteComponentProps<{organizationId: string; projectId: string}, {}>;

function ProjectAlerts({children, organization, ...props}: Props) {
  return (
    <Access organization={organization} access={['project:write']}>
      {({hasAccess}) => (
        <Feature organization={organization} features={['incidents']}>
          {({hasFeature}) => (
            <React.Fragment>
              <ProjectAlertHeader canEditRule={hasAccess} {...props} />

              {React.isValidElement(children) &&
                React.cloneElement(children, {
                  hasMetricAlerts: hasFeature,
                })}
            </React.Fragment>
          )}
        </Feature>
      )}
    </Access>
  );
}

export default ProjectAlerts;
