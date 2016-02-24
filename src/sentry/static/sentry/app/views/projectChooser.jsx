import React from 'react';
import {History} from 'react-router';
import $ from 'jquery';
import {t} from '../locale';

import OrganizationState from '../mixins/organizationState';
import TodoList from '../components/todos';

const ProjectChooser = React.createClass({
  mixins: [
    OrganizationState,
    History
  ],

  componentWillMount() {
    $(document.body).addClass('narrow');
  },

  componentWillUnmount() {
    $(document.body).removeClass('narrow');
  },

  render() {
    let org = this.getOrganization();

    // Expect onboarding=1 and task=<task id> parameters and task.featureLocation == 'project'
    // TODO throw up report dialog if not true
    let task = TodoList.TASKS.filter((task_inst) => task_inst.task == this.props.location.query.task)[0];
    if (task.featureLocation != 'project') {
      throw new Error('User arrived on project chooser without a valid task id.');
    }
    let teamProjectList = org.teams.map((team) => {

      // Get list of projects per team
      let projectList = team.projects.map(project => {
        return (<tr key={project.id}><td><h5>
          <a href={`/${org.slug}/${project.slug}/${task.location}`}>{project.name}</a>
        </h5></td></tr>);
      });

      return(
        <div className="box">
          <div key={team.id}>
            <div className="box-header" key={team.id}>
              <h3>{team.name}</h3>
            </div>
            <div className="box-content">
              <table className="table project-list">
                <tbody>
                  {projectList}
                </tbody>
              </table>
            </div>
          </div>
        </div>);
    });

    return (
      <div className="container">
        <h3>{t('Choose a project')}</h3>
        <div className="team-list">
          {teamProjectList}
        </div>
      </div>
    );
  },
});

export default ProjectChooser;
