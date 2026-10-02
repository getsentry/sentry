import {Fragment} from 'react';

import {Access} from 'sentry/components/acl/access';
import {Outlet, useOutletContext} from 'sentry/router/reactRouter';
import type {DetailedProject} from 'sentry/types/project';
import {useProjectSettingsOutlet} from 'sentry/views/settings/project/projectSettingsLayout';

type ProjectAlertsOutletContext = {
  canEditRule: boolean;
  project: DetailedProject;
};

function ProjectAlertsOutlet(props: ProjectAlertsOutletContext) {
  return <Outlet context={props} />;
}

export function useProjectAlertsOutlet() {
  return useOutletContext<ProjectAlertsOutletContext>();
}

export default function ProjectAlerts() {
  const {project} = useProjectSettingsOutlet();

  return (
    <Access access={['project:write']} project={project}>
      {({hasAccess}) => (
        <Fragment>
          <ProjectAlertsOutlet canEditRule={hasAccess} project={project} />
        </Fragment>
      )}
    </Access>
  );
}
