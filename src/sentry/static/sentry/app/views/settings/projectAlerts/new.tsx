import {Params} from 'react-router/lib/Router';
import React from 'react';

import ProjectAlertHeader from './projectAlertHeaderNew';

type Props = {
  params: Params;
  children: React.ReactNode;
};

function ProjectAlerts({params, children}: Props) {
  return (
    <React.Fragment>
      <ProjectAlertHeader projectId={params.projectId} />
      {children}
    </React.Fragment>
  );
}

export default ProjectAlerts;
