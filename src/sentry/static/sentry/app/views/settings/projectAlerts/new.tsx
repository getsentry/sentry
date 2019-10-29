import React from 'react';

import {RouterProps} from 'app/types';

import ProjectAlertHeader from './projectAlertHeaderNew';

type Props = RouterProps & {
  children: React.ReactNode;
};

function ProjectAlerts({children, ...props}: Props) {
  return (
    <React.Fragment>
      <ProjectAlertHeader {...props} />
      {children}
    </React.Fragment>
  );
}

export default ProjectAlerts;
