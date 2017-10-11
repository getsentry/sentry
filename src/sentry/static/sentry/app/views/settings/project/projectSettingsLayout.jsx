import React from 'react';

import ProjectContext from '../../projects/projectContext';
import ProjectSettingsNavigation from './projectSettingsNavigation';
import SettingsLayout from '../settingsLayout';
import SentryTypes from '../../../proptypes';

class ProjectSettingsLayout extends React.Component {
  static contextTypes = {
    organization: SentryTypes.Organization,
  };

  render() {
    let {orgId, projectId} = this.props.params;

    return (
      <ProjectContext {...this.props.params} orgId={orgId} projectId={projectId}>
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
