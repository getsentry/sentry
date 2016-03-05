import React from 'react';
import {History} from 'react-router';
import ActionOverlay from '../../components/actionOverlay';
import OrganizationState from '../../mixins/organizationState';
import ApiMixin from '../../mixins/apiMixin';
import {t} from '../../locale';
import update from 'react-addons-update';

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


const SetCallsignsAction = React.createClass({
  mixins: [ApiMixin, History, OrganizationState],

  getInitialState() {
    return {
      isLoading: true,
      info: {},
      callsigns: {}
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  onSubmit(event) {
    this.setState({
      isLoading: true
    });

    let orgId = this.getOrganization().slug;
    this.api.request(`/organizations/${orgId}/shortids/`, {
      method: 'PUT',
      data: {'callsigns': this.state.callsigns},
      success: (data) => {
        this.context.history.pushState('refresh', `/${orgId}/`);
      },
      error: (error) => {
        /*eslint no-console:0*/
        console.log('Failed to set callsigns:', error);
        alert(t('Failed to set callsigns'));
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
      callsigns: update(this.state.callsigns, {
        [projectId]: {$set: event.target.value.toUpperCase().trim()}
      }),
    });
  },

  fetchData() {
    let info = getProjectInfoForReview(this.getOrganization());
    let callsigns = {};
    info.projects.forEach((project) => {
      callsigns[project.projectId] = project.callSign;
    });

    this.setState({
      info: info,
      callsigns: callsigns,
      isLoading: false,
    });
  },

  isValidCallsign(callsign) {
    let found = 0;

    if (callsign.match(/^[A-Z]{2,6}$/) === null) {
      return false;
    }

    for (let key in this.state.callsigns) {
      if (this.state.callsigns[key] === callsign) {
        found++;
      }
    }
    return found <= 1;
  },

  render() {
    let org = this.getOrganization();
    let info = this.state.info;
    let canSubmit = true;

    return (
      <ActionOverlay actionId="SET_CALLSIGNS" isLoading={this.state.isLoading}>
        <h1>{t('Review Call Signs for Projects')}</h1>
        <p>{t('Sentry now requires you to specify a call sign (short name) for each project in the organization “%s”. These short names are used to identify the project in the issue IDs.  Ideally they are two or three letter long.', org.name)}</p>
        {info.hasNonMemberProjects
          ? <p>{t('Projects of teams you are not a member of are shown grayed out.')}</p> : null}
        <p>{t('Projects which have been previously reviewed are shown in green.')}</p>
        <form className="form-horizontal">
          {info.projects.map((project) => {
            let inputId = 'input-' + project.projectId;
            let disabled = !project.canReview;
            let className = 'form-group short-id-form-group';
            let callsign = this.state.callsigns[project.projectId] || '';
            if (disabled) {
              className += ' disabled';
            }
            if (!project.requiresReview) {
              className += ' reviewed';
            }
            if (!this.isValidCallsign(callsign)) {
              className += ' invalid';
              canSubmit = false;
            }
            if (callsign == '') {
              className += ' empty';
              canSubmit = false;
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
                    value={callsign}/>
                </div>
              </div>
            );
          })}
          <div className="actions">
            <button type="button"
              onClick={this.onSubmit}
              className="btn btn-primary btn-lg"
              disabled={!canSubmit}>
              {t('Set Call Signs')}
            </button>
          </div>
        </form>
      </ActionOverlay>
    );
  }
});

SetCallsignsAction.requiresAction = function(org) {
  let info = getProjectInfoForReview(org);
  return info.requiresReview > 0 && info.canReviewAnything;
};

SetCallsignsAction.getActionLinkTitle = function() {
  return t('Review Call Signs for Projects');
};

export default SetCallsignsAction;
