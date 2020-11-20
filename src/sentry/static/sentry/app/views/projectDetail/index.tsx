import React from 'react';

import Feature from 'app/components/acl/feature';
import Alert from 'app/components/alert';
import {t} from 'app/locale';
import {PageContent} from 'app/styles/organization';
import withOrganization from 'app/utils/withOrganization';

import ProjectDetail from './projectDetail';

function ProjectDetailContainer(props: ProjectDetail['props']) {
  function renderNoAccess() {
    return (
      <PageContent>
        <Alert type="warning">{t("You don't have access to this feature")}</Alert>
      </PageContent>
    );
  }

  return (
    <Feature
      features={['project-detail']}
      organization={props.organization}
      renderDisabled={renderNoAccess}
    >
      <ProjectDetail {...props} />
    </Feature>
  );
}

export default withOrganization(ProjectDetailContainer);
