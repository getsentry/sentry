import React from 'react';
import createReactClass from 'create-react-class';

import HookStore from 'app/stores/hookStore';
import SentryTypes from 'app/sentryTypes';
import SettingsNavigation from 'app/views/settings/components/settingsNavigation';
import getConfiguration from 'app/views/settings/project/navigationConfiguration';
import withOrganization from 'app/utils/withOrganization';
import withProject from 'app/utils/withProject';

const ProjectSettingsNavigation = createReactClass({
  propTypes: {
    organization: SentryTypes.Organization,
    project: SentryTypes.Project,
  },

  getInitialState() {
    // Allow injection via getsentry et all
    const org = this.props.organization;
    const hooks = [];
    HookStore.get('project:settings-sidebar').forEach(cb => {
      hooks.push(cb(org));
    });

    return {
      hooks,
    };
  },

  render() {
    const {organization, project} = this.props;

    return (
      <SettingsNavigation
        navigationObjects={getConfiguration({project, organization})}
        access={new Set(organization.access)}
        features={new Set(organization.features)}
        organization={organization}
        project={project}
        hooks={this.state.hooks}
      />
    );
  },
});

export default withProject(withOrganization(ProjectSettingsNavigation));
