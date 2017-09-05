import React from 'react';

import SentryTypes from '../proptypes';

export default function withProject(WrappedComponent) {
  class WithProject extends React.Component {
    static contextTypes = {
      project: SentryTypes.Project
    };

    render() {
      let {project} = this.context;
      return (
        <WrappedComponent
          project={project}
          getProjectFeatures={() => new Set(project.features)}
          {...this.props}
        />
      );
    }
  }

  return WithProject;
}
