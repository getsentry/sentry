import {withRouter} from 'react-router';
import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';

import {setLastRoute} from 'app/actionCreators/navigation';
import SentryTypes from 'app/proptypes';
import EnvironmentStore from 'app/stores/environmentStore';
import ProjectHeader from 'app/components/projectHeader';
import ProjectState from 'app/mixins/projectState';
import withEnvironment from 'app/utils/withEnvironment';

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

  componentWillUnmount() {
    // Save last route so that we can jump back to view from settings
    setLastRoute(this.props.location.pathname);
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

export {ProjectDetailsLayout};
export default withRouter(withEnvironment(ProjectDetailsLayout));
