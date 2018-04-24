import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';

import SentryTypes from '../proptypes';
import EnvironmentStore from '../stores/environmentStore';
import ProjectHeader from '../components/projectHeader';
import ProjectState from '../mixins/projectState';
import withEnvironment from '../utils/withEnvironment';

const ProjectDetailsLayout = createReactClass({
  displayName: 'ProjectDetailsLayout',

  propTypes: {
    environment: SentryTypes.Environment,
  },

  mixins: [ProjectState, Reflux.connect(EnvironmentStore, 'environments')],

  getInitialState() {
    return {
      environments: EnvironmentStore.getActive() || [],
      projectNavSection: null,
    };
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
      <React.Fragment>
        <ProjectHeader
          activeSection={this.state.projectNavSection}
          project={this.context.project}
          organization={this.getOrganization()}
          environments={this.state.environments}
          activeEnvironment={this.props.environment}
        />
        <div className="container">
          <div className="content">
            {React.cloneElement(this.props.children, {
              setProjectNavSection: this.setProjectNavSection,
              memberList: this.state.memberList,
            })}
          </div>
        </div>
      </React.Fragment>
    );
  },
});

export default withEnvironment(ProjectDetailsLayout);
