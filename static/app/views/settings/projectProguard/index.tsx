import React from 'react';

import Alert from 'app/components/alert';
import {t} from 'app/locale';
import {PageContent} from 'app/styles/organization';
import withOrganization from 'app/utils/withOrganization';

import ProjectProguard from './projectProguard';

class ProjectProguardContainer extends React.Component<ProjectProguard['props']> {
  renderNoAccess() {
    return (
      <PageContent>
        <Alert type="warning">{t("You don't have access to this feature")}</Alert>
      </PageContent>
    );
  }

  render() {
    return <ProjectProguard {...this.props} />;
  }
}

export default withOrganization(ProjectProguardContainer);
