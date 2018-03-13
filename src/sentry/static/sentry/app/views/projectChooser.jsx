import React from 'react';
import createReactClass from 'create-react-class';
import {browserHistory} from 'react-router';
import $ from 'jquery';
import {t} from '../locale';

import OrganizationState from '../mixins/organizationState';
import TodoList from '../components/onboardingWizard/todos';

const ProjectChooser = createReactClass({
  displayName: 'ProjectChooser',
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
    let features = new Set(org.features);

    // Expect onboarding=1 and task=<task id> parameters and task.featureLocation == 'project'
    // TODO throw up report dialog if not true
    if (task.featureLocation != 'project') {
      throw new Error('User arrived on project chooser without a valid task id.');
    }
    return (
      <div className="container">
        <h3>{t('Choose a project')}</h3>
        <div className="box">
          <div className="box-content">
            <table className="table">
              <tbody>
                {org.projects.map(project => {
                  return (
                    <tr key={project.id}>
                      <td>
                        <h4>
                          <a href={`/${org.slug}/${project.slug}/${task.location}`}>
                            {features.has('new-teams') ? project.slug : project.name}
                          </a>
                        </h4>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  },
});

export default ProjectChooser;
