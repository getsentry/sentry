import React from 'react';
import PropTypes from 'prop-types';

import LazyLoad from '../components/lazyLoad';
import getSettingsComponent from '../utils/getSettingsComponent';

class TeamMembers extends React.Component {
  static propTypes = {
    routes: PropTypes.array,
  };

  render() {
    return (
      <LazyLoad
        component={() =>
          getSettingsComponent(
            () =>
              import(/*webpackChunkName: "teamMembers"*/ './settings/team/teamMembers'),
            () =>
              import(/*webpackChunkName: "teamMembers.old"*/ './settings/team/teamMembers.old'),
            this.props.routes
          )}
        {...this.props}
      />
    );
  }
}

export default TeamMembers;
