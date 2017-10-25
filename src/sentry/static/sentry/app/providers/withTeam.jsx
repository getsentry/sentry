import React from 'react';

import SentryTypes from '../proptypes';

export default function withTeam(WrappedComponent) {
  class WithTeam extends React.Component {
    static contextTypes = {
      team: SentryTypes.Team
    };

    render() {
      let {team} = this.context;
      return (
        <WrappedComponent
          team={team}
          {...this.props}
        />
      );
    }
  }

  return WithTeam;
}
