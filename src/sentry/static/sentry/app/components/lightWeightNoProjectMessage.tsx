import React from 'react';

import {LightWeightOrganization, Organization, Project} from 'app/types';
import NoProjectMessage from 'app/components/noProjectMessage';
import withProjects from 'app/utils/withProjects';

type Props = {
  organization: LightWeightOrganization | Organization;
  projects: Project[];
  loadingProjects: boolean;
};

class LightWeightNoProjectMessage extends React.Component<Props> {
  render() {
    const {organization, projects, loadingProjects} = this.props;
    if ('projects' in organization) {
      return <NoProjectMessage {...this.props} />;
    }
    if (loadingProjects) {
      return this.props.children;
    }
    return <NoProjectMessage {...this.props} projects={projects} />;
  }
}

export default withProjects(LightWeightNoProjectMessage);
