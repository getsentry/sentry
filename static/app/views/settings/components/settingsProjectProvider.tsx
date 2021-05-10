import {cloneElement, Component, isValidElement} from 'react';

import {Project} from 'app/types';
import withProject from 'app/utils/withProject';

type Props = {
  project: Project;
};

/**
 * Simple Component that takes project from context and passes it as props to children
 *
 * Don't do anything additional (e.g. loader) because not all children require project
 *
 * This is made because some components (e.g. ProjectPluginDetail) takes project as prop
 */
class SettingsProjectProvider extends Component<Props> {
  render() {
    const {children, project} = this.props;

    if (isValidElement(children)) {
      return cloneElement(children, {
        ...this.props,
        ...children.props,
        project,
      });
    }
    return null;
  }
}

export default withProject(SettingsProjectProvider);
