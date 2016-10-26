import React from 'react';

import ApiMixin from '../../mixins/apiMixin';
import ProjectSelector from '../../components/projectHeader/projectSelector';
import ProjectState from '../../mixins/projectState';

import LoadingError from '../../components/loadingError';
import LoadingIndicator from '../../components/loadingIndicator';

const ProjectInstallLayout = React.createClass({
  mixins: [
    ApiMixin,
    ProjectState
  ],

  getInitialState() {
    return {
      loading: true,
      platformList: null,
      project: null,
      team: null
    };
  },

  componentDidMount() {
    this.fetchData();
  },

  fetchData() {
    let org = this.context.organization;
    if (!org) {
      return;
    }

    let orgId = this.context.organization.slug;
    let projectId = this.context.project.slug;

    this.api.request(`/projects/${orgId}/${projectId}/docs/`, {
      success: (data) => {
        this.setState({
          loading: false,
          data: data
        });
      }
    });
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
    let project = this.context.project;
    if (!project) return null;
    return (
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
    );
  }
});

export default ProjectInstallLayout;