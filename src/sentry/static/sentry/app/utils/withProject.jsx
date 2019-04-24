import React from 'react';

import SentryTypes from 'app/sentryTypes';
import getDisplayName from 'app/utils/getDisplayName';

/**
 * Currently wraps component with project from context
 */
const withProject = WrappedComponent =>
  class extends React.Component {
    static displayName = `withProject(${getDisplayName(WrappedComponent)})`;
    static contextTypes = {
      project: SentryTypes.Project,
    };

    render() {
      return <WrappedComponent project={this.context.project} {...this.props} />;
    }
  };

export default withProject;
