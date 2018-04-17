import React from 'react';
import createReactClass from 'create-react-class';
import {browserHistory} from 'react-router';
import $ from 'jquery';
import styled from 'react-emotion';

import {Box} from '../components/grid';
import {t} from '../locale';
import Link from '../components/link';
import OrganizationState from '../mixins/organizationState';
import {sortProjects} from '../utils';
import theme from '../utils/theme';
import TodoList from '../components/onboardingWizard/todos';
import {Panel, PanelBody, PanelHeader, PanelItem} from '../components/panels';
import SettingsPageHeader from './settings/components/settingsPageHeader';
import ProjectLabel from '../components/projectLabel';
import SentryTypes from '../proptypes';

const ProjectChooser = createReactClass({
  displayName: 'ProjectChooser',

  propTypes: {
    organization: SentryTypes.Organization,
  },

  mixins: [OrganizationState],

  componentWillMount() {
    this.redirectNoMultipleProjects();
  },

  componentWillUnmount() {
    $(document.body).removeClass('narrow');
  },

  redirectNoMultipleProjects() {
    let org = this.getOrganization();
    let projects = org.projects;
    let task = TodoList.TASKS.filter(
      task_inst => task_inst.task == this.props.location.query.task
    )[0];

    if (projects.length === 0) {
      browserHistory.push(`/organizations/${org.slug}/projects/new/`);
    } else if (projects.length === 1) {
      let project = projects[0];
      browserHistory.push(`/${org.slug}/${project.slug}/${task.location}`);
    }
  },

  render() {
    let org = this.getOrganization();
    let task = TodoList.TASKS.filter(
      task_inst => task_inst.task == this.props.location.query.task
    )[0];

    // Expect onboarding=1 and task=<task id> parameters and task.featureLocation == 'project'
    // TODO throw up report dialog if not true
    if (task.featureLocation != 'project') {
      throw new Error('User arrived on project chooser without a valid task id.');
    }
    return (
      <div className="container" css={{'padding-left': '90px', 'padding-top': '30px'}}>
        <SettingsPageHeader title="Projects" />
        <Panel>
          <PanelHeader hasButtons>{t('Projects')}</PanelHeader>
          <PanelBody css={{width: '100%'}}>
            {sortProjects(org.projects).map((project, i) => (
              <PanelItem p={0} key={project.slug} align="center">
                <Box p={2} flex="1">
                  <Link
                    to={`/${org.slug}/${project.slug}/${task.location}`}
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
  },
});

const StyledProjectLabel = styled(ProjectLabel)`
  color: ${p => p.theme.blue};
`;

export default ProjectChooser;
