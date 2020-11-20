import React from 'react';

import Feature from 'app/components/acl/feature';
import Alert from 'app/components/alert';
import {t} from 'app/locale';
import SentryTypes from 'app/sentryTypes';
import {PageContent} from 'app/styles/organization';
import withOrganization from 'app/utils/withOrganization';

import ProjectProguard from './projectProguard';

class ProjectProguardContainer extends React.Component<ProjectProguard['props']> {
  static propTypes = {
    organization: SentryTypes.Organization.isRequired,
  };

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
