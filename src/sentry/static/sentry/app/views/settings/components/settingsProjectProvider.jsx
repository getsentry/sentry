import {cloneElement, Component} from 'react';

import SentryTypes from 'app/sentryTypes';

/**
 * Simple Component that takes project from context and passes it as props to children
 *
 * Don't do anything additional (e.g. loader) because not all children require project
 *
 * This is made because some components (e.g. ProjectPluginDetail) takes project as prop
 */
class SettingsProjectProvider extends Component {
  static contextTypes = {
    project: SentryTypes.Project,
  };

  render() {
    const {children} = this.props;
    const {project} = this.context;

    return cloneElement(children, {
      ...this.props,
      ...children.props,
      project,
    });
  }
}

export default SettingsProjectProvider;
