import React from 'react';
import styled from '@emotion/styled';

import Button from 'app/components/button';
import ProjectBadge from 'app/components/idBadge/projectBadge';
import {Panel, PanelBody, PanelHeader, PanelItem} from 'app/components/panels';
import {t} from 'app/locale';
import {Organization, Project} from 'app/types';
import withOrganization from 'app/utils/withOrganization';
import withProjects from 'app/utils/withProjects';
import EmptyMessage from 'app/views/settings/components/emptyMessage';

type Props = {
  projects: Project[];
  organization: Organization;
};

const IntegrationAlertRules = ({projects, organization}: Props) => (
  <Panel>
    <PanelHeader>{t('Project Configuration')}</PanelHeader>
    <PanelBody>
      {projects.length === 0 && (
        <EmptyMessage size="large">
          {t('You have no projects to add Alert Rules to')}
        </EmptyMessage>
      )}
      {projects.map(project => (
        <ProjectItem key={project.slug}>
          <ProjectBadge project={project} avatarSize={16} />
          <Button
            to={`/organizations/${organization.slug}/alerts/${project.slug}/new/`}
            size="xsmall"
          >
            {t('Add Alert Rule')}
          </Button>
        </ProjectItem>
      ))}
    </PanelBody>
  </Panel>
);

const ProjectItem = styled(PanelItem)`
  align-items: center;
  justify-content: space-between;
`;

export default withOrganization(withProjects(IntegrationAlertRules));
