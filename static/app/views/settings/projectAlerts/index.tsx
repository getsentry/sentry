import {cloneElement, Fragment, isValidElement} from 'react';
import type {RouteComponentProps} from 'react-router';

import Access from 'sentry/components/acl/access';
import {Organization, Project} from 'sentry/types';

interface Props
  extends RouteComponentProps<{organizationId: string; projectId: string}, {}> {
  children: React.ReactNode;
  organization: Organization;
  project: Project;
}

function ProjectAlerts({children, organization, project}: Props) {
  return (
    <Access access={['project:write']} project={project}>
      {({hasAccess}) => (
        <Fragment>
          {isValidElement(children) &&
            cloneElement<any>(children, {
              organization,
              canEditRule: hasAccess,
            })}
        </Fragment>
      )}
    </Access>
  );
}

export default ProjectAlerts;
