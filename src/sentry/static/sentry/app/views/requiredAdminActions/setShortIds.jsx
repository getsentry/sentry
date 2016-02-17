import React from 'react';
import ActionOverlay from '../../components/actionOverlay';
import OrganizationState from '../../mixins/organizationState';
import {t} from '../../locale';


const SetShortIdsAction = React.createClass({
  mixins: [OrganizationState],

  getProjectList() {
    let org = this.getOrganization();
    let projects = [];
    for (let i = 0; i < org.teams.length; i++) {
      for (let j = 0; j < org.teams[i].projects.length; j++) {
        let project = org.teams[i].projects[j];
        projects.push({
          projectId: project.id,
          projectName: project.name,
          teamName: org.teams[i].name,
          shortName: project.shortName || null
        });
      }
    }

    return projects;
  },

  render() {
    let org = this.getOrganization();
    let projects = this.getProjectList();

    return (
      <ActionOverlay actionId="SET_SHORT_IDS">
        <h1>{t('Add Call Signs to Projects')}</h1>
        <p>{t('Sentry now requires you to specify a call sign (short name) for each project in the organization “%s”. These short names are used to identify the project in the issue IDs.  Ideally they are two or three letter long.', org.name)}</p>
        <form className="form-horizontal">
          {projects.map((project) => {
            let inputId = 'input-' + project.projectId;
            return (
              <div className="form-group short-id-form-group" key={project.projectId}>
                <label htmlFor={inputId}
                  className="col-sm-6 col-sm-offset-2 control-label">
                  {project.teamName} / {project.projectName}
                </label>
                <div className="col-sm-2">
                  <input type="text"
                    id={inputId}
                    className="form-control"
                    defaultValue={project.shortName}/>
                </div>
              </div>
            );
          })}
          <div className="actions">
            <button type="button" className="btn btn-primary btn-lg">
              {t('Set Call Signs')}
            </button>
          </div>
        </form>
      </ActionOverlay>
    );
  }
});

SetShortIdsAction.getActionLinkTitle = function() {
  return t('Call Signs for Projects');
};

export default SetShortIdsAction;
