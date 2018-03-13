import PropTypes from 'prop-types';
import React from 'react';

import LazyLoad from '../components/lazyLoad';
import getSettingsComponent from '../utils/getSettingsComponent';

class TeamSettings extends React.Component {
  static propTypes = {
    routes: PropTypes.array,
  };

  render() {
    return (
      <LazyLoad
        component={() =>
          getSettingsComponent(
            () =>
              import(/*webpackChunkName: "teamSettings"*/ './settings/team/teamSettings'),
            () =>
              import(/*webpackChunkName: "teamSettings.old"*/ './settings/team/teamSettings.old'),
            this.props.routes
          )}
        {...this.props}
      />
    );
  }
}

export default TeamSettings;
