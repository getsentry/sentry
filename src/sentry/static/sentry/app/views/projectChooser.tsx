import $ from 'jquery';
import {browserHistory} from 'react-router';
import React from 'react';
import styled from 'react-emotion';

import {Location} from 'history';
import {Organization, Project} from 'app/types';
import {Panel, PanelBody, PanelHeader, PanelItem} from 'app/components/panels';
import {sortProjects} from 'app/utils';
import {t} from 'app/locale';
import Link from 'app/components/links/link';
import ProjectLabel from 'app/components/projectLabel';
import SentryTypes from 'app/sentryTypes';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import getOnboardingTasks from 'app/components/onboardingWizard/getOnboardingTasks';
import space from 'app/styles/space';
import withOrganization from 'app/utils/withOrganization';

type Props = {
  organization: Organization;
  location: Location;
};

class ProjectChooser extends React.Component<Props> {
  static propTypes = {
    organization: SentryTypes.Organization.isRequired,
  };

  componentWillMount() {
    this.redirectNoMultipleProjects();
  }

  componentWillUnmount() {
    $(document.body).removeClass('narrow');
  }

  get onboardingTask() {
    const {organization, location} = this.props;
    const tasks = getOnboardingTasks(organization);
    return tasks.find(
      task =>
        typeof location.query.task === 'string' &&
        task.task === parseInt(location.query.task, 10)
    );
  }

  redirectNoMultipleProjects() {
    const {organization} = this.props;
    const projects = organization.projects;
    const task = this.onboardingTask;

    if (projects.length === 0) {
      browserHistory.push(`/organizations/${organization.slug}/projects/new/`);
    } else if (projects.length === 1 && task) {
      const project = projects[0];
      browserHistory.push(`/${organization.slug}/${project.slug}/${task.location}`);
    }
  }

  render() {
    const {organization} = this.props;
    const task = this.onboardingTask;

    // Expect onboarding=1 and task=<task id> parameters and task.featureLocation === 'project'
    // TODO throw up report dialog if not true
    if (!task || task.featureLocation !== 'project') {
      throw new Error('User arrived on project chooser without a valid task id.');
    }
    return (
      <ProjectChooserWrapper className="container">
        <SettingsPageHeader title="Projects" />
        <Panel>
          <PanelHeader>{t('Projects')}</PanelHeader>
          <PanelBody>
            {sortProjects(organization.projects).map((project: Project) => (
              <PanelItemSmall key={project.slug}>
                <StyledLink to={`/${organization.slug}/${project.slug}/${task.location}`}>
                  <StyledProjectLabel project={project} />
                </StyledLink>
              </PanelItemSmall>
            ))}
          </PanelBody>
        </Panel>
      </ProjectChooserWrapper>
    );
  }
}

const StyledProjectLabel = styled(ProjectLabel)`
  color: ${p => p.theme.blue};
`;

const ProjectChooserWrapper = styled('div')`
  padding-top: ${space(4)};
`;

const PanelItemSmall = styled(PanelItem)`
  padding: 0;
`;

const StyledLink = styled(Link)`
  padding: ${space(2)};
  flex: 1;
`;

export default withOrganization(ProjectChooser);
