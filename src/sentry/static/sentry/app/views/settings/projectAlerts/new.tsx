import {RouteComponentProps} from 'react-router/lib/Router';
import React from 'react';

import ProjectAlertHeader from './projectAlertHeaderNew';

type Props = {
  children: React.ReactNode;
} & RouteComponentProps<{organizationId: string; projectId: string}, {}>;

function ProjectAlerts({children, ...props}: Props) {
  return (
    <React.Fragment>
      <ProjectAlertHeader {...props} />
      {children}
    </React.Fragment>
  );
}

export default ProjectAlerts;
