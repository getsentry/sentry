import React from 'react';

import {LightWeightOrganization, Organization} from 'app/types';
import NoProjectMessage from 'app/components/noProjectMessage';
import Projects from 'app/utils/projects';

type Props = {
  organization: LightWeightOrganization | Organization;
};

export default class LightWeightNoProjectMessage extends React.Component<Props> {
  renderChildren = ({projects, fetching}) => {
    if (fetching) {
      return this.props.children;
    }
    return <NoProjectMessage {...this.props} projects={projects} />;
  };

  render() {
    const {organization} = this.props;

    return 'projects' in organization ? (
      <NoProjectMessage {...this.props} />
    ) : (
      <Projects orgId={this.props.organization.slug} allProjects>
        {this.renderChildren}
      </Projects>
    );
  }
}
