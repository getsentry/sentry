import {Component} from 'react';
import {RouteComponentProps} from 'react-router';

import Feature from 'sentry/components/acl/feature';
import {Organization, Project} from 'sentry/types';
import withOrganization from 'sentry/utils/withOrganization';

import ProjectPerformance from './projectPerformance';

type Props = RouteComponentProps<{orgId: string; projectId: string}, {}> & {
  organization: Organization;
  project: Project;
};

class ProjectPerformanceContainer extends Component<Props> {
  render() {
    return (
      <Feature features={['performance-view']}>
        <ProjectPerformance {...this.props} />
      </Feature>
    );
  }
}

export default withOrganization(ProjectPerformanceContainer);
