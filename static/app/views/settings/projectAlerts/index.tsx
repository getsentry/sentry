import {cloneElement, Fragment, isValidElement} from 'react';
import type {RouteComponentProps} from 'react-router';

import Access from 'sentry/components/acl/access';
import {Organization} from 'sentry/types';

interface Props
  extends RouteComponentProps<{organizationId: string; projectId: string}, {}> {
  children: React.ReactNode;
  organization: Organization;
}

const ProjectAlerts = ({children, organization}: Props) => (
  <Access organization={organization} access={['project:write']}>
    {({hasAccess}) => (
      <Fragment>
        {isValidElement(children) &&
          cloneElement(children, {
            organization,
            canEditRule: hasAccess,
          })}
      </Fragment>
    )}
  </Access>
);

export default ProjectAlerts;
