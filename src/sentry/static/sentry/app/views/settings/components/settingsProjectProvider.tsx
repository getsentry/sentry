import React from 'react';

import SentryTypes from 'app/sentryTypes';
import {Project} from 'app/types';

/**
 * Simple Component that takes project from context and passes it as props to children
 *
 * Don't do anything additional (e.g. loader) because not all children require project
 *
 * This is made because some components (e.g. ProjectPluginDetail) takes project as prop
 */
class SettingsProjectProvider extends React.Component {
  static contextTypes = {
    project: SentryTypes.Project,
  };

  render() {
    const {children} = this.props;
    const {project}: {project: Project} = this.context;

    if (React.isValidElement(children)) {
      return React.cloneElement(children, {
        ...this.props,
        ...children.props,
        project,
      });
    }
    return null;
  }
}

export default SettingsProjectProvider;
