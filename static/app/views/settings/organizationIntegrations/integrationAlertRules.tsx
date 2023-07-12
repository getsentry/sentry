import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import EmptyMessage from 'sentry/components/emptyMessage';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import PanelItem from 'sentry/components/panels/panelItem';
import {t} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import withOrganization from 'sentry/utils/withOrganization';
import withProjects from 'sentry/utils/withProjects';

type Props = {
  organization: Organization;
  projects: Project[];
};

function IntegrationAlertRules({projects, organization}: Props) {
  return (
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
              to={`/organizations/${organization.slug}/alerts/${project.slug}/wizard/`}
              size="xs"
            >
              {t('Add Alert Rule')}
            </Button>
          </ProjectItem>
        ))}
      </PanelBody>
    </Panel>
  );
}

const ProjectItem = styled(PanelItem)`
  align-items: center;
  justify-content: space-between;
`;

export default withOrganization(withProjects(IntegrationAlertRules));
