import {cloneElement, Fragment, isValidElement} from 'react';

import Access from 'sentry/components/acl/access';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';

interface Props extends RouteComponentProps<{organizationId: string; projectId: string}> {
  children: React.ReactNode;
  organization: Organization;
  project: Project;
}

function ProjectAlerts({children, project}: Props) {
  return (
    <Access access={['project:write']} project={project}>
      {({hasAccess}) => (
        <Fragment>
          {isValidElement(children) &&
            cloneElement<any>(children, {
              canEditRule: hasAccess,
            })}
        </Fragment>
      )}
    </Access>
  );
}

export default ProjectAlerts;
