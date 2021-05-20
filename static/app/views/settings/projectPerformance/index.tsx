import React from 'react';
import {RouteComponentProps} from 'react-router';

import {Organization, Project} from 'app/types';
import withOrganization from 'app/utils/withOrganization';

import ProjectPerformance from './projectPerformance';

type Props = RouteComponentProps<{orgId: string; projectId: string}, {}> & {
  organization: Organization;
  project: Project;
};

class ProjectPerformanceContainer extends React.Component<Props> {
  render() {
    return <ProjectPerformance {...this.props} />;
  }
}

export default withOrganization(ProjectPerformanceContainer);
