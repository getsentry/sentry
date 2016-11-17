import React from 'react';

import ProjectContext from './projects/projectContext';
import ProjectHeader from '../components/projectHeader';
import ProjectState from '../mixins/projectState';

const ProjectDetailsLayout = React.createClass({
  mixins: [
    ProjectState
  ],

  getInitialState() {
    return {
      projectNavSection: null
    };
  },

  /**
   * This callback can be invoked by the child component
   * to update the active nav section (which is then passed
   * to the ProjectHeader
   */
  setProjectNavSection(section) {
    this.setState({
      projectNavSection: section
    });
  },

  render() {
    if (!this.context.project)
      return null;

    return (
     <div>
        <ProjectHeader
          activeSection={this.state.projectNavSection}
          project={this.context.project}
          organization={this.getOrganization()} />
        <div className="container">
          <div className="content">
            {React.cloneElement(this.props.children, {
              setProjectNavSection: this.setProjectNavSection,
              memberList: this.state.memberList
            })}
          </div>
        </div>
      </div>
    );
  }
});

const ProjectDetails = React.createClass({
  render() {
    let {projectId, orgId} = this.props.params;
    return (
      <ProjectContext orgId={orgId} projectId={projectId}>
        <ProjectDetailsLayout>
          {this.props.children}
        </ProjectDetailsLayout>
      </ProjectContext>
    );
  }
});

export default ProjectDetails;
