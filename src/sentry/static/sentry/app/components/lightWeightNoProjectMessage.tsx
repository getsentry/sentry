import { Component } from 'react';

import {LightWeightOrganization, Organization, Project} from 'app/types';
import NoProjectMessage from 'app/components/noProjectMessage';
import withProjects from 'app/utils/withProjects';

type Props = {
  organization: LightWeightOrganization | Organization;
  projects: Project[];
  loadingProjects: boolean;
};

class LightWeightNoProjectMessage extends Component<Props> {
  render() {
    const {organization, projects, loadingProjects} = this.props;
    return (
      <NoProjectMessage
        {...this.props}
        projects={projects}
        loadingProjects={!('projects' in organization) && loadingProjects}
      />
    );
  }
}

export default withProjects(LightWeightNoProjectMessage);
