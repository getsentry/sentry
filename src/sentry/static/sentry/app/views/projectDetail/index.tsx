import React from 'react';
import {RouteComponentProps} from 'react-router/lib/Router';

import {t} from 'app/locale';
import {Organization} from 'app/types';
import {PageContent} from 'app/styles/organization';
import Feature from 'app/components/acl/feature';
import Alert from 'app/components/alert';
import withOrganization from 'app/utils/withOrganization';

import ProjectDetail from './projectDetail';

type RouteParams = {
  orgId: string;
  projectId: string;
};

type Props = RouteComponentProps<RouteParams, {}> & {
  organization: Organization;
};

function ProjectDetailContainer(props: Props) {
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
