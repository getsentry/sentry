import React from 'react';
import {browserHistory} from 'react-router';
import $ from 'jquery';
import {Box} from 'grid-emotion';
import styled from 'react-emotion';

import {t} from 'app/locale';
import Link from 'app/components/links/link';
import {sortProjects} from 'app/utils';
import theme from 'app/utils/theme';
import {TASKS} from 'app/components/onboardingWizard/todos';
import {Panel, PanelBody, PanelHeader, PanelItem} from 'app/components/panels';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import ProjectLabel from 'app/components/projectLabel';
import SentryTypes from 'app/sentryTypes';
import withOrganization from 'app/utils/withOrganization';

class ProjectChooser extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization.isRequired,
  };

  componentWillMount() {
    this.redirectNoMultipleProjects();
  }

  componentWillUnmount() {
    $(document.body).removeClass('narrow');
  }

  redirectNoMultipleProjects() {
    const {organization} = this.props;
    const projects = organization.projects;
    const tasks = TASKS.filter(
      task_inst => task_inst.task === this.props.location.query.task
    );

    if (projects.length === 0) {
      browserHistory.push(`/organizations/${organization.slug}/projects/new/`);
    } else if (projects.length === 1 && tasks && tasks.length === 1) {
      const project = projects[0];
      browserHistory.push(`/${organization.slug}/${project.slug}/${tasks[0].location}`);
    }
  }

  render() {
    const {organization} = this.props;
    const task = TASKS.filter(
      task_inst => task_inst.task === parseInt(this.props.location.query.task, 10)
    )[0];

    // Expect onboarding=1 and task=<task id> parameters and task.featureLocation === 'project'
    // TODO throw up report dialog if not true
    if (!task || task.featureLocation !== 'project') {
      throw new Error('User arrived on project chooser without a valid task id.');
    }
    return (
      <div className="container" css={{'padding-left': '90px', 'padding-top': '30px'}}>
        <SettingsPageHeader title="Projects" />
        <Panel>
          <PanelHeader hasButtons>{t('Projects')}</PanelHeader>
          <PanelBody css={{width: '100%'}}>
            {sortProjects(organization.projects).map((project, i) => (
              <PanelItem p={0} key={project.slug} align="center">
                <Box p={2} flex="1">
                  <Link
                    to={`/${organization.slug}/${project.slug}/${task.location}`}
                    css={{color: theme.gray3}}
                  >
                    <StyledProjectLabel
                      project={project}
                      organization={this.props.organization}
                    />
                  </Link>
                </Box>
              </PanelItem>
            ))}
          </PanelBody>
        </Panel>
      </div>
    );
  }
}

const StyledProjectLabel = styled(ProjectLabel)`
  color: ${p => p.theme.blue};
`;

export default withOrganization(ProjectChooser);
