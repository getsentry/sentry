import * as React from 'react';

import {Project} from 'app/types';
import {Project as ProjectPropType} from 'app/sentryTypes';

type Props = React.HTMLProps<HTMLSpanElement> & {
  project: Project;
};

export default class ProjectLabel extends React.PureComponent<Props> {
  static propTypes = {
    project: ProjectPropType.isRequired,
  };

  render() {
    const {project, ...props} = this.props;

    return (
      <span className="project-label" {...props}>
        <span className="project-name">{project.slug}</span>
      </span>
    );
  }
}
