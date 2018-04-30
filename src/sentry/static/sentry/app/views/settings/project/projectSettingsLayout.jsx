import React from 'react';

import ProjectContext from 'app/views/projects/projectContext';
import ProjectSettingsNavigation from 'app/views/settings/project/projectSettingsNavigation';
import SettingsLayout from 'app/views/settings/components/settingsLayout';
import SentryTypes from 'app/proptypes';

class ProjectSettingsLayout extends React.Component {
  static contextTypes = {
    organization: SentryTypes.Organization,
  };

  render() {
    let {orgId, projectId} = this.props.params;

    return (
      <ProjectContext
        {...this.props.params}
        skipReload
        orgId={orgId}
        projectId={projectId}
      >
        <SettingsLayout
          {...this.props}
          renderNavigation={() => <ProjectSettingsNavigation {...this.props} />}
        >
          {this.props.children &&
            React.cloneElement(this.props.children, {
              organization: this.context.organization,
              setProjectNavSection: () => {},
            })}
        </SettingsLayout>
      </ProjectContext>
    );
  }
}

export default ProjectSettingsLayout;
