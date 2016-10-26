import React from 'react';

import ApiMixin from '../../mixins/apiMixin';
import DocumentTitle from 'react-document-title';
import ProjectSelector from '../../components/projectHeader/projectSelector';
import LoadingError from '../../components/loadingError';
import LoadingIndicator from '../../components/loadingIndicator';

import OrganizationState from '../../mixins/organizationState';

const ProjectInstall = React.createClass({
  childContextTypes: {
    project: React.PropTypes.Project,
    team: React.PropTypes.object
  },

  mixins: [
    ApiMixin,
    OrganizationState
  ],

  getInitialState() {
    return {
      loading: true,
      platformList: null,
      project: null,
      team: null
    };
  },

  getChildContext() {
    return {
      project: this.state.project,
      team: this.state.team
    };
  },

  componentWillMount() {
    // this.props.setProjectNavSection('settings');
  },

  componentDidMount() {
    this.fetchData();
  },

  fetchData() {
    let org = this.context.organization;
    if (!org) {
      return;
    }

    let [activeTeam, activeProject] = this.identifyProject();

    this.setState({
      project: activeProject,
      team: activeTeam
    });

    let {orgId, projectId} = this.props.params;
    this.api.request(`/projects/${orgId}/${projectId}/docs/`, {
      success: (data) => {
        this.setState({
          loading: false,
          data: data
        });
      }
    });
  },

  identifyProject() {
    let {params} = this.props;
    let projectSlug = params.projectId;
    let activeProject = null;
    let activeTeam = null;
    let org = this.context.organization;
    org.teams.forEach((team) => {
      team.projects.forEach((project) => {
        if (project.slug == projectSlug) {
          activeProject = project;
          activeTeam = team;
        }
      });
    });
    return [activeTeam, activeProject];
  },

  getTitle() {
    return 'lol';
  },

  renderBody() {
    if (this.state.loading)
      return <LoadingIndicator />;
    else if (this.state.error)
      return <LoadingError onRetry={this.fetchData} />;

    let data = this.state.data;
    return React.cloneElement(this.props.children, {
      platformData: data // {...this.props}
    });
  },

  render() {
    let org = this.context.organization;
    let {project} = this.state;
    if (!project)
      return null;

    return (
      <DocumentTitle title={this.getTitle()}>
        <div>
          <div className="sub-header flex flex-container flex-vertically-centered">
            <div className="p-t-1">
              <ProjectSelector
                  organization={org}
                  projectId={project.slug}/>
            </div>
          </div>
          <div className="container">
            <div className="content">
              {this.renderBody()}
            </div>
          </div>
        </div>
      </DocumentTitle>
    );
  }
});

export default ProjectInstall;
