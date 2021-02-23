import React from 'react';

import ComingSoon from 'app/components/acl/comingSoon';
import Feature from 'app/components/acl/feature';
import {PageContent} from 'app/styles/organization';
import withOrganization from 'app/utils/withOrganization';

import ProjectProguard from './projectProguard';

class ProjectProguardContainer extends React.Component<ProjectProguard['props']> {
  renderNoAccess() {
    return (
      <PageContent>
        <ComingSoon />
      </PageContent>
    );
  }

  render() {
    const {organization} = this.props;

    return (
      <Feature
        features={['android-mappings']}
        organization={organization}
        renderDisabled={this.renderNoAccess}
      >
        <ProjectProguard {...this.props} />
      </Feature>
    );
  }
}

export default withOrganization(ProjectProguardContainer);
