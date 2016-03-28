import React from 'react';
import {History} from 'react-router';
import ActionOverlay from '../../components/actionOverlay';
import OrganizationState from '../../mixins/organizationState';
import ApiMixin from '../../mixins/apiMixin';
import {t} from '../../locale';
import update from 'react-addons-update';


/* given an organization find information about the projects that are
   needed for callsign review.  Splits up projects you are a member of or
   not into different lists. */
function getProjectInfoForReview(org) {
  let memberProjects = [];
  let nonMemberProjects = [];
  let requiresReview = 0;
  let canReviewAnything = false;
  let canWriteProjects = (new Set(org.access)).has('project:write');

  for (let team of org.teams) {
    for (let project of team.projects) {
      let canReview = false;
      let targetList = nonMemberProjects;
      if (team.isMember) {
        canReview = canWriteProjects;
        if (!project.callSignReviewed) {
          requiresReview++;
          canReviewAnything = canReviewAnything || canReview;
        }
        targetList = memberProjects;
      }
      targetList.push({
        projectId: project.id,
        projectName: project.name,
        isMember: team.isMember,
        requiresReview: !project.callSignReviewed,
        canReview: canReview,
        teamName: team.name,
        callSign: project.callSign || null
      });
    }
  }

  return {
    memberProjects: memberProjects,
    nonMemberProjects: nonMemberProjects,
    projects: memberProjects.concat(nonMemberProjects),
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
      slugs: {}
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
    this.api.request(`/organizations/${orgId}/slugs/`, {
      method: 'PUT',
      data: {slugs: this.state.slugs},
      success: (data) => {
        this.context.history.pushState('refresh', `/${orgId}/`);
      },
      error: (error) => {
        /*eslint no-console:0*/
        console.log('Failed to set slugs:', error);
        /*eslint no-alert:0*/
        alert(t('Failed to set slugs'));
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
      slugs: update(this.state.slugs, {
        [projectId]: {$set: event.target.value.toUpperCase().trim()}
      }),
    });
  },

  fetchData() {
    let info = getProjectInfoForReview(this.getOrganization());
    let slugs = {};
    info.memberProjects.forEach((project) => {
      slugs[project.projectId] = project.callSign;
    });

    this.setState({
      info: info,
      slugs: slugs,
      isLoading: false,
    });
  },

  isValidCallsign(callsign) {
    let found = 0;

    if (callsign.match(/^[A-Z]{2,6}$/) === null) {
      return false;
    }

    for (let key in this.state.slugs) {
      if (this.state.slugs[key] === callsign) {
        found++;
      }
    }

    this.state.info.nonMemberProjects.forEach((project) => {
      if (project.callSign === callsign) {
        found++;
      }
    });

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
          ? <p>{t('Projects of teams you are not a member of are not shown.')}</p> : null}
        <p>{t('Projects which have been previously reviewed are shown in green.')}</p>
        <form className="form-horizontal">
          {info.memberProjects.map((project) => {
            let inputId = 'input-' + project.projectId;
            let className = 'form-group short-id-form-group';
            let callsign = this.state.slugs[project.projectId] || '';
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
  return info.requiresReview > 0 && info.canReviewAnything &&
    (new Set(org.access)).has('callsigns');
};

SetCallsignsAction.getActionLinkTitle = function() {
  return t('Review Call Signs for Projects');
};

export default SetCallsignsAction;
