import React from 'react';
import {History} from 'react-router';

import OrganizationState from '../mixins/organizationState';
import TodoList from '../components/todos';

const ProjectChooser = React.createClass({
  mixins: [
    OrganizationState,
    History
  ],

  componentWillMount() {
    jQuery(document.body).addClass('narrow');
  },

  componentWillUnmount() {
    jQuery(document.body).removeClass('narrow');
  },

  render() {
    let org = this.getOrganization();

    // Expect onboarding=1 and task=<task id> parameters and task.feature_location == 'project'
    // TODO throw up report dialog if not true
    let task = TodoList.TASKS.filter((t) => t.task == this.props.location.query.task)[0];
    if (task.feature_location != 'project') {
      throw new Error('User arrived on project chooser without a valid task id.');
    }
    let teamProjectList = [];

    org.teams.map((team) => {
      let projectList = [];
      team.projects.map((project) => {
        let next_url = '/' + org.slug+ '/' + project.slug + '/' + task.location;
        projectList.push(
          <tr key={project.id}><td><h5>
            <a href={next_url}>{project.name}</a>
          </h5></td></tr>);
      });

      teamProjectList.push(
        <div key={team.id}>
          <div className='box-header' key={team.id}>
            <h3>{team.name}</h3>
          </div>
          <div className='box-content'>
            <table className='table project-list'>
              <tbody>
                {projectList}
              </tbody>
            </table>
          </div>
        </div>);
    });

    return (
      <div className='container'>
        <h3>Choose a project</h3>
        <div className='team-list'>
          <div className='box'>
            {teamProjectList}
          </div>
        </div>
      </div>
    );
  },
});

export default ProjectChooser;
