import React from 'react';
import {browserHistory} from 'react-router';
import $ from 'jquery';
import {t} from '../locale';

import OrganizationState from '../mixins/organizationState';
import TodoList from '../components/onboardingWizard/todos';

const ProjectChooser = React.createClass({
  mixins: [OrganizationState],

  componentWillMount() {
    $(document.body).addClass('narrow');
    this.redirectNoMultipleProjects();
  },

  componentWillUnmount() {
    $(document.body).removeClass('narrow');
  },

  redirectNoMultipleProjects() {
    let org = this.getOrganization();
    let teams = org.teams.filter(team => team.projects.length > 0);
    let projects = [].concat.apply([], teams.map(team => team.projects));
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
    let teams = org.teams.filter(team => team.projects.length > 0);
    let task = TodoList.TASKS.filter(
      task_inst => task_inst.task == this.props.location.query.task
    )[0];

    // Expect onboarding=1 and task=<task id> parameters and task.featureLocation == 'project'
    // TODO throw up report dialog if not true
    if (task.featureLocation != 'project') {
      throw new Error('User arrived on project chooser without a valid task id.');
    }
    let teamProjectList = teams.map((team, i) => {
      // Get list of projects per team
      let projectList = team.projects.map(project => {
        return (
          <tr key={project.id}>
            <td>
              <h4>
                <a href={`/${org.slug}/${project.slug}/${task.location}`}>
                  {project.name}
                </a>
              </h4>
            </td>
          </tr>
        );
      });

      return (
        <div className="box" key={i}>
          <div key={team.id}>
            <div className="box-header" key={team.id}>
              <h2>{team.name}</h2>
            </div>
            <div className="box-content">
              <table className="table">
                <tbody>
                  {projectList}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      );
    });

    return (
      <div className="container">
        <h3>{t('Choose a project')}</h3>
        <div className="team-list">
          {teamProjectList}
        </div>
      </div>
    );
  }
});

export default ProjectChooser;
