import React from 'react';
import PropTypes from 'prop-types';

import LazyLoad from '../components/lazyLoad';
import getSettingsComponent from '../utils/getSettingsComponent';

class TeamProjects extends React.Component {
  static propTypes = {
    routes: PropTypes.array,
  };

  render() {
    return (
      <LazyLoad
        component={() =>
          getSettingsComponent(
            () =>
              import(/*webpackChunkName: "TeamProjects"*/ './settings/team/teamProjects'),
            () =>
              import(/*webpackChunkName: "TeamProjects"*/ './settings/team/teamProjects'),
            // new Promise(resolve => resolve({default: () => <h1>Not Implemented</h1>})),
            this.props.routes
          )}
        {...this.props}
      />
    );
  }
}

export default TeamProjects;
