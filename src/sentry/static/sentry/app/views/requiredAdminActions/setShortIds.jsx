import React from 'react';
import ActionOverlay from '../../components/actionOverlay';
import OrganizationState from '../../mixins/organizationState';
import ApiMixin from '../../mixins/apiMixin';
import {t} from '../../locale';

function getProjectInfoForReview(org) {
  let projects = [];
  let nonMemberProjects = [];
  let requiresReview = 0;
  let canReviewAnything = false;
  let canWriteProjects = (new Set(org.access)).has('project:write');

  for (let i = 0; i < org.teams.length; i++) {
    let team = org.teams[i];
    for (let j = 0; j < team.projects.length; j++) {
      let project = team.projects[j];
      let canReview = false;
      let targetList = nonMemberProjects;
      if (team.isMember) {
        canReview = canWriteProjects;
        if (!project.callSignReviewed) {
          requiresReview++;
          canReviewAnything = canReviewAnything || canReview;
        }
        targetList = projects;
      }
      targetList.push({
        projectId: project.id,
        projectName: project.name,
        isMember: team.isMember,
        requiresReview: !project.callSignReviewed,
        canReview: canReview,
        teamName: org.teams[i].name,
        callSign: project.callSign || null
      });
    }
  }

  projects = projects.concat(nonMemberProjects);

  return {
    projects: projects,
    requiresReview: requiresReview,
    canReviewAnything: canReviewAnything,
    hasNonMemberProjects: nonMemberProjects.length > 0
  };
}


const SetShortIdsAction = React.createClass({
  mixins: [ApiMixin, OrganizationState],

  getInitialState() {
    return {
      isLoading: false,
      shortIds: {}
    };
  },

  getProjectList() {
    return getProjectInfoForReview(this.getOrganization()).projects;
  },

  onSubmit(event) {
    this.setState({
      isLoading: true
    });

    let orgId = this.getOrganization().slug;
    this.api.request(`/organizations/${orgId}/shortids/`, {
      method: 'PUT',
      data: this.state.shortIds,
      success: (data) => {
      },
      error: (error) => {
      },
      complete: () => {
        this.setState({
          isLoading: false
        });
      }
    });
  },

  onSetShortName(projectId, event) {
    this.setState({

    });
  },

  render() {
    let org = this.getOrganization();
    let info = getProjectInfoForReview(this.getOrganization());
    let projects = info.projects;

    return (
      <ActionOverlay actionId="SET_SHORT_IDS" isLoading={this.state.isLoading}>
        <h1>{t('Review Call Signs for Projects')}</h1>
        <p>{t('Sentry now requires you to specify a call sign (short name) for each project in the organization “%s”. These short names are used to identify the project in the issue IDs.  Ideally they are two or three letter long.', org.name)}</p>
        {info.hasNonMemberProjects
          ? <p>{t('Projects of teams you are not a member of are shown grayed out.')}</p> : null}
        <p>{t('Projects which have been previously reviewed are shown in green.')}</p>
        <form className="form-horizontal">
          {projects.map((project) => {
            let inputId = 'input-' + project.projectId;
            let disabled = !project.canReview;
            let className = 'form-group short-id-form-group';
            if (disabled) {
              className += ' disabled';
            }
            if (!project.requiresReview) {
              className += ' reviewed';
            }

            return (
              <div className={className} key={project.projectId}>
                <label htmlFor={inputId}
                  className="col-sm-6 col-sm-offset-2 control-label">
                  {project.teamName} / {project.projectName}
                </label>
                <div className="col-sm-2">
                  <input type="text"
                    id={inputId}
                    disabled={disabled}
                    className="form-control"
                    onChange={this.onSetShortName.bind(this, project.projectId)}
                    value={project.callSign}/>
                </div>
              </div>
            );
          })}
          <div className="actions">
            <button type="button"
              onClick={this.onSubmit}
              className="btn btn-primary btn-lg">
              {t('Set Call Signs')}
            </button>
          </div>
        </form>
      </ActionOverlay>
    );
  }
});

SetShortIdsAction.requiresAction = function(org) {
  let info = getProjectInfoForReview(org);
  return info.requiresReview > 0 && info.canReviewAnything;
};

SetShortIdsAction.getActionLinkTitle = function() {
  return t('Review Call Signs for Projects');
};

export default SetShortIdsAction;
