import React from 'react';

import {t} from 'app/locale';
import {PageContent} from 'app/styles/organization';
import Feature from 'app/components/acl/feature';
import Alert from 'app/components/alert';
import withOrganization from 'app/utils/withOrganization';

import ProjectSourceMaps from './projectSourceMaps';

class ProjectSourceMapsContainer extends React.Component<ProjectSourceMaps['props']> {
  renderNoAccess() {
    return (
      <PageContent>
        <Alert type="warning">{t("You don't have access to this feature")}</Alert>
      </PageContent>
    );
  }

  render() {
    const {organization} = this.props;

    return (
      <Feature
        features={['artifacts-in-settings']}
        organization={organization}
        renderDisabled={this.renderNoAccess}
      >
        <ProjectSourceMaps {...this.props} />
      </Feature>
    );
  }
}

export default withOrganization(ProjectSourceMapsContainer);
