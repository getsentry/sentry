import React from 'react';
import SentryTypes from 'app/proptypes';

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
    let {children} = this.props;
    let {project} = this.context;

    return React.cloneElement(children, {
      ...this.props,
      ...children.props,
      project,
    });
  }
}

export default SettingsProjectProvider;
