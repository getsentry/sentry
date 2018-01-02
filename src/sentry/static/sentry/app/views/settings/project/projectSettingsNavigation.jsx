import React from 'react';

import createReactClass from 'create-react-class';

import HookStore from '../../../stores/hookStore';
import ProjectState from '../../../mixins/projectState';
import SettingsNavigation from '../components/settingsNavigation';
import getConfiguration from './navigationConfiguration';

const ProjectSettingsNavigation = createReactClass({
  displayName: 'ProjectSettingsNavigation',
  mixins: [ProjectState],

  getInitialState() {
    // Allow injection via getsentry et all
    let org = this.getOrganization();
    let hooks = [];
    HookStore.get('project:settings-sidebar').forEach(cb => {
      hooks.push(cb(org));
    });

    return {
      hooks,
    };
  },

  render() {
    let access = this.getAccess();
    let features = this.getFeatures();
    let org = this.getOrganization();
    let project = this.getProject();

    return (
      <SettingsNavigation
        navigationObjects={getConfiguration(project)}
        access={access}
        features={features}
        organization={org}
        project={project}
        hooks={this.state.hooks}
      />
    );
  },
});

export default ProjectSettingsNavigation;
