import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';

import EnvironmentStore from '../stores/environmentStore';
import LatestContextStore from '../stores/latestContextStore';

import ProjectHeader from '../components/projectHeader';
import ProjectState from '../mixins/projectState';

const ProjectDetailsLayout = createReactClass({
  displayName: 'ProjectDetailsLayout',
  mixins: [
    ProjectState,
    Reflux.connect(EnvironmentStore, 'environments'),
    Reflux.listenTo(LatestContextStore, 'onLatestContextChange'),
  ],

  getInitialState() {
    return {
      environments: [],
      projectNavSection: null,
      activeEnvironment: null,
    };
  },

  onLatestContextChange(context) {
    this.setState({
      activeEnvironment: context.environment,
    });
  },

  /**
   * This callback can be invoked by the child component
   * to update the active nav section (which is then passed
   * to the ProjectHeader
   */
  setProjectNavSection(section) {
    this.setState({
      projectNavSection: section,
    });
  },

  render() {
    if (!this.context.project) return null;

    return (
      <div>
        <ProjectHeader
          activeSection={this.state.projectNavSection}
          project={this.context.project}
          organization={this.getOrganization()}
          environments={this.state.environments}
          activeEnvironment={this.state.activeEnvironment}
        />
        <div className="container">
          <div className="content">
            {React.cloneElement(this.props.children, {
              setProjectNavSection: this.setProjectNavSection,
              memberList: this.state.memberList,
            })}
          </div>
        </div>
      </div>
    );
  },
});

export default ProjectDetailsLayout;
