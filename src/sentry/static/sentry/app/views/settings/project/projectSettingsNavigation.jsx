import React from 'react';

import createReactClass from 'create-react-class';

import HookStore from 'app/stores/hookStore';
import ProjectState from 'app/mixins/projectState';
import SettingsNavigation from 'app/views/settings/components/settingsNavigation';
import getConfiguration from 'app/views/settings/project/navigationConfiguration';

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
